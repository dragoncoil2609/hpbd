// Hand tracking with MediaPipe Tasks Vision (runs fully in the browser).
const VERSION = '0.10.14';
const VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/vision_bundle.mjs`;
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
const FINGERS = [[8, 6], [12, 10], [16, 14], [20, 18]]; // [tip, pip]
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class HandController {
  constructor(video, overlay) {
    this.video = video;
    this.overlay = overlay;
    this.ctx = overlay.getContext('2d');
    this.running = false;
    this.landmarker = null;
    this.stream = null;
    this.lastTime = -1;
    this.lastSeen = 0;
    this.prev = null;
    this.candidate = 'none';
    this.candidateCount = 0;
    this.state = { present: false, gesture: 'none', openness: 0, palm: 0.2, dx: 0, dy: 0, tip: { x: 0.5, y: 0.5 } };
  }

  async start() {
    if (!this.landmarker) {
      const { FilesetResolver, HandLandmarker } = await import(VISION_URL);
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      const opts = (delegate) => ({
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5,
      });
      try {
        this.landmarker = await HandLandmarker.createFromOptions(fileset, opts('GPU'));
      } catch {
        this.landmarker = await HandLandmarker.createFromOptions(fileset, opts('CPU'));
      }
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();
    this.overlay.width = this.video.videoWidth;
    this.overlay.height = this.video.videoHeight;
    this.running = true;
  }

  stop() {
    this.running = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.prev = null;
    Object.assign(this.state, { present: false, gesture: 'none', dx: 0, dy: 0 });
  }

  update(now) {
    const s = this.state;
    s.dx = s.dy = 0;
    const v = this.video;
    if (!this.running || v.readyState < 2 || v.currentTime === this.lastTime) return s;
    this.lastTime = v.currentTime;

    const res = this.landmarker.detectForVideo(v, now);
    const lm = res.landmarks?.[0];
    this.draw(lm);

    if (!lm) {
      if (now - this.lastSeen > 350) {
        s.present = false;
        s.gesture = 'none';
        this.prev = null;
      }
      return s;
    }
    this.lastSeen = now;

    // mirrored + aspect-corrected points so distances are isotropic
    const ar = v.videoWidth / v.videoHeight;
    const P = lm.map((p) => ({ x: (1 - p.x) * ar, y: p.y }));
    const d = (a, b) => Math.hypot(P[a].x - P[b].x, P[a].y - P[b].y);

    const palm = d(0, 9);
    const ext = FINGERS.map(([tip, pip]) => d(tip, 0) > d(pip, 0) * 1.1);
    const n = ext.filter(Boolean).length;
    let g = 'partial';
    if (n >= 4) g = 'open';
    else if (n === 0) g = 'fist';
    else if (ext[0] && ext[1] && !ext[2] && !ext[3]) g = 'victory';
    else if (ext[0] && !ext[1] && !ext[2] && !ext[3]) g = 'point';

    // require a few stable frames before switching gesture
    if (g === this.candidate) this.candidateCount++;
    else {
      this.candidate = g;
      this.candidateCount = 1;
    }
    if (this.candidateCount >= 3 || !s.present) s.gesture = g;

    const ratio = FINGERS.reduce((a, [tip]) => a + d(tip, 0), 0) / 4 / palm;
    const open = clamp((ratio - 1.05) / 0.75, 0, 1);
    s.openness = s.present ? s.openness + (open - s.openness) * 0.3 : open;
    s.palm = s.present ? s.palm + (palm - s.palm) * 0.25 : palm;

    const ids = [0, 5, 9, 13, 17];
    const cx = ids.reduce((a, i) => a + P[i].x, 0) / ids.length / ar;
    const cy = ids.reduce((a, i) => a + P[i].y, 0) / ids.length;
    if (this.prev) {
      // ignore tiny jitter
      const dx = cx - this.prev.x, dy = cy - this.prev.y;
      s.dx = Math.abs(dx) > 0.002 ? dx : 0;
      s.dy = Math.abs(dy) > 0.002 ? dy : 0;
    }
    this.prev = { x: cx, y: cy };

    const tip = { x: 1 - lm[8].x, y: lm[8].y };
    s.tip = s.present ? { x: s.tip.x + (tip.x - s.tip.x) * 0.5, y: s.tip.y + (tip.y - s.tip.y) * 0.5 } : tip;
    s.present = true;
    return s;
  }

  draw(lm) {
    const { ctx, overlay: c } = this;
    ctx.clearRect(0, 0, c.width, c.height);
    if (!lm) return;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,140,200,0.9)';
    ctx.beginPath();
    for (const [a, b] of CONNECTIONS) {
      ctx.moveTo(lm[a].x * c.width, lm[a].y * c.height);
      ctx.lineTo(lm[b].x * c.width, lm[b].y * c.height);
    }
    ctx.stroke();
    ctx.fillStyle = '#fff';
    for (const p of lm) {
      ctx.beginPath();
      ctx.arc(p.x * c.width, p.y * c.height, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
