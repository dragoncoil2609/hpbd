import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import CONFIG from './config.js?v=5';
import { HandController } from './hands.js?v=5';
import { BirthdaySong } from './music.js?v=5';

const $ = (s) => document.querySelector(s);
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const smooth = (x) => x * x * (3 - 2 * x);
function gauss() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const isMobile = matchMedia('(max-width: 768px), (pointer: coarse)').matches;
const ARMS = 3;
const ARM_TWIST = 0.33;
const GALAXY_R = 24;

// ---------------------------------------------------------------- renderer
const canvas = $('#scene');
// the scene is drawn into the composer's render targets, so canvas MSAA would be wasted work
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const MAX_PR = Math.min(devicePixelRatio, isMobile ? 1.5 : 1.75);
renderer.setPixelRatio(MAX_PR);
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07040f);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1000);
// Portrait phones: look down more steeply so the disk fills the tall screen (the arms may run
// off the sides and sweep back in as it turns), and draw photos and wishes larger.
const view = { portrait: false, photoScale: 1, wishScale: 1 };
function fitView() {
  const aspect = innerWidth / innerHeight;
  view.portrait = aspect < 0.85;
  view.photoScale = view.portrait ? 1.42 : 1;
  view.wishScale = view.portrait ? 1.45 : 1;
  return view.portrait ? new THREE.Vector3(0, 0.85, 0.53).multiplyScalar(52 - aspect * 10) : new THREE.Vector3(0, 19, 22);
}
camera.position.copy(fitView());

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 6;
controls.maxDistance = 70;
controls.rotateSpeed = 0.6;

// MSAA only where pixels are big enough for jaggies to show
const composer = new EffectComposer(
  renderer,
  new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: MAX_PR > 1.25 ? 0 : 4 })
);
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.75, 0.35, 0.9);
// bloom is a blur anyway: half resolution looks the same and costs a quarter
const bloomSetSize = bloom.setSize.bind(bloom);
bloom.setSize = (w, h) => bloomSetSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
composer.addPass(bloom);
composer.addPass(new OutputPass());
composer.setSize(innerWidth, innerHeight);

const world = new THREE.Group();
scene.add(world);

// ---------------------------------------------------------------- textures
function glowTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const dotTex = glowTexture([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]);

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

const PH_EMOJI = ['💖', '🌸', '✨', '🌙', '🦋', '🌷', '⭐', '🎀', '🍓', '☁️', '🌈', '💌'];

function makePhotoTexture(src, i, onAspect) {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const frame = (drawInner) => {
    const W = c.width, H = c.height;
    g.clearRect(0, 0, W, H);
    roundRect(g, 0, 0, W, H, 30);
    g.fillStyle = '#fff6fb';
    g.fill();
    g.save();
    roundRect(g, 16, 16, W - 32, H - 32, 20);
    g.clip();
    drawInner(16, W - 32, H - 32);
    g.restore();
    tex.needsUpdate = true;
  };

  frame((o, w) => {
    const hue = (320 + i * 47) % 360;
    const grad = g.createLinearGradient(o, o, o + w, o + w);
    grad.addColorStop(0, `hsl(${hue},85%,74%)`);
    grad.addColorStop(1, `hsl(${(hue + 50) % 360},70%,42%)`);
    g.fillStyle = grad;
    g.fillRect(o, o, w, w);
    for (let k = 0; k < 40; k++) {
      g.fillStyle = `rgba(255,255,255,${rand(0.2, 0.8)})`;
      g.beginPath();
      g.arc(o + rand(0, w), o + rand(0, w), rand(1, 4), 0, Math.PI * 2);
      g.fill();
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '190px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
    g.fillText(PH_EMOJI[i % PH_EMOJI.length], S / 2, S / 2 - 30);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.font = '600 38px "Be Vietnam Pro", sans-serif';
    g.fillText(`Kỷ niệm #${i + 1}`, S / 2, S - 90);
  });

  if (src) {
    const img = new Image();
    img.src = src;
    // decode() works off the main thread, so big photos don't stall the animation
    img.decode().then(() => {
      // keep the photo's own shape (within limits) instead of a square crop
      const a = clamp(img.width / img.height, 0.62, 1.6);
      const L = 640;
      c.width = Math.round(a >= 1 ? L : L * a);
      c.height = Math.round(a >= 1 ? L / a : L);
      tex.dispose(); // canvas size changed: let three.js allocate a new GPU texture
      frame((o, w, h) => {
        const s = Math.max(w / img.width, h / img.height);
        const iw = img.width * s, ih = img.height * s;
        g.drawImage(img, o + (w - iw) / 2, o + (h - ih) / 2, iw, ih);
      });
      onAspect?.(c.width / c.height);
    }, () => console.warn('Không tải được ảnh:', src));
  }
  return { tex, canvas: c };
}

function makeTextTexture(text) {
  const font = '700 64px "Dancing Script", cursive';
  const maxW = 820, lineH = 78, pad = 36;
  const m = document.createElement('canvas').getContext('2d');
  m.font = font;
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? line + ' ' + word : word;
    if (m.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  lines.push(line);
  const w = Math.ceil(Math.max(...lines.map((l) => m.measureText(l).width)) + pad * 2);
  const h = lines.length * lineH + pad * 2;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((l, k) => {
    const y = pad + lineH * (k + 0.5);
    g.shadowColor = '#ff4fa3';
    g.shadowBlur = 22;
    g.fillStyle = '#ffd3ea';
    g.fillText(l, w / 2, y);
    g.shadowBlur = 6;
    g.fillStyle = '#fff6fb';
    g.fillText(l, w / 2, y);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData.w = w;
  t.userData.h = h;
  return t;
}

// ---------------------------------------------------------------- background stars
let stars;
{
  const n = 4000;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3(gauss(), gauss(), gauss()).normalize().multiplyScalar(rand(150, 420));
    pos.set([v.x, v.y, v.z], i * 3);
    c.setHSL(rand(0.55, 0.95), 0.6, rand(0.6, 0.95));
    col.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  stars = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ size: 1.6, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  scene.add(stars);
}

// ---------------------------------------------------------------- galaxy particles
const galaxyMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uExpand: { value: 0 },
    uTime: { value: 0 },
    uScale: { value: renderer.getPixelRatio() * 95 },
  },
  vertexShader: /* glsl */ `
    attribute vec3 aCompact;
    attribute vec3 aColor;
    attribute float aSize;
    attribute float aSeed;
    uniform float uExpand;
    uniform float uTime;
    uniform float uScale;
    varying vec3 vColor;
    varying float vTw;
    void main() {
      float e = clamp(uExpand * 1.15 - aSeed * 0.15, 0.0, 1.0);
      e = e * e * (3.0 - 2.0 * e);
      vec3 p = mix(aCompact, position, e);
      // swirl a little while travelling between the two shapes
      float swirl = sin(e * 3.14159) * (1.2 + aSeed);
      float s = sin(swirl), c = cos(swirl);
      p.xz = mat2(c, -s, s, c) * p.xz;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      // gentle, slow twinkle in brightness only: strong size/brightness swings made bloom pop on and off
      vTw = 0.86 + 0.14 * sin(uTime * (0.5 + aSeed * 0.8) + aSeed * 40.0);
      // points smaller than ~1.5px shimmer as they move: draw them at 1.5px and dim them instead
      float size = aSize * uScale / -mv.z;
      vTw *= clamp(size / 1.5, 0.15, 1.0);
      gl_PointSize = clamp(size, 1.5, 40.0 * uScale / 95.0);
      vColor = aColor;
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec3 vColor;
    varying float vTw;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d);
      a *= a;
      gl_FragColor = vec4(vColor * a * 1.6 * vTw, a);
    }
  `,
});

{
  const n = isMobile ? 12000 : 26000;
  const pos = new Float32Array(n * 3);
  const comp = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const seed = new Float32Array(n);
  const cIn = new THREE.Color('#fff0f7');
  const cMid = new THREE.Color('#ff5fae');
  const cOut = new THREE.Color('#8088ff');
  const accents = [new THREE.Color('#7af0ff'), new THREE.Color('#ffd36e'), new THREE.Color('#c39bff')];
  const tilt = new THREE.Euler(0.45, 0, 0.2);
  const tmp = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    // spiral galaxy shape
    const r = Math.pow(Math.random(), 1.15) * GALAXY_R + 0.3;
    const arm = i % ARMS;
    const ang = (arm / ARMS) * Math.PI * 2 + r * ARM_TWIST;
    const spread = 0.25 + r * 0.055;
    pos[i * 3] = Math.cos(ang) * r + gauss() * spread;
    pos[i * 3 + 1] = gauss() * spread * 0.35 * (1.3 - r / GALAXY_R);
    pos[i * 3 + 2] = Math.sin(ang) * r + gauss() * spread;

    // compact shape: glowing shell + tilted ring around the core
    if (Math.random() < 0.62) {
      tmp.set(gauss(), gauss(), gauss()).normalize().multiplyScalar(5 + gauss() * 0.8);
    } else {
      const a = Math.random() * Math.PI * 2;
      const rr = 8.5 + gauss() * 0.7;
      tmp.set(Math.cos(a) * rr, gauss() * 0.25, Math.sin(a) * rr).applyEuler(tilt);
    }
    comp.set([tmp.x, tmp.y, tmp.z], i * 3);

    const t = r / GALAXY_R;
    c.copy(cIn).lerp(cMid, Math.min(t * 2.2, 1)).lerp(cOut, clamp((t - 0.35) * 1.6, 0, 1));
    if (Math.random() < 0.08) c.copy(accents[i % accents.length]);
    col.set([c.r, c.g, c.b], i * 3);
    size[i] = (Math.random() < 0.03 ? rand(2.5, 4) : rand(0.5, 1.6)) * (1 + t * 0.7);
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aCompact', new THREE.BufferAttribute(comp, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const pts = new THREE.Points(geo, galaxyMat);
  pts.frustumCulled = false;
  world.add(pts);
}

// ---------------------------------------------------------------- core
const core = new THREE.Group();
world.add(core);
const orbMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec3 vN;
    varying vec3 vV;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal);
      vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    varying vec3 vN;
    varying vec3 vV;
    void main() {
      float f = pow(1.0 - abs(dot(vN, vV)), 2.2);
      vec3 col = 0.55 + 0.45 * cos(6.2831 * (f * 0.9 + uTime * 0.08 + vN.y * 0.3 + vec3(0.0, 0.33, 0.67)));
      gl_FragColor = vec4(col * f * 1.4, f);
    }
  `,
});
const orb = new THREE.Mesh(new THREE.SphereGeometry(2.3, 48, 48), orbMat);
core.add(orb);
const glowBig = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: glowTexture([[0, 'rgba(255,220,240,0.7)'], [0.25, 'rgba(255,110,190,0.18)'], [1, 'rgba(120,60,255,0)']]),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  })
);
glowBig.scale.setScalar(12);
core.add(glowBig);
const glowSmall = new THREE.Sprite(
  new THREE.SpriteMaterial({ map: dotTex, color: 0xfff3fa, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
);
glowSmall.scale.setScalar(3);
core.add(glowSmall);

// ---------------------------------------------------------------- photos
const wishes = CONFIG.wishes?.length ? CONFIG.wishes : ['♡'];
const photoSources = CONFIG.photos?.length
  ? CONFIG.photos
  : Array.from({ length: CONFIG.placeholderCount || 24 }, () => null);
const planeGeo = new THREE.PlaneGeometry(1, 1);
const photos = [];
{
  const N = photoSources.length;
  const golden = Math.PI * (3 - Math.sqrt(5));
  photoSources.forEach((src, i) => {
    const { tex, canvas: pc } = makePhotoTexture(src, i, (a) => {
      mesh.userData.sx = Math.sqrt(a);
      mesh.userData.sy = 1 / Math.sqrt(a);
    });
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, toneMapped: false,
      color: new THREE.Color(0.86, 0.86, 0.86),
    });
    const mesh = new THREE.Mesh(planeGeo, mat);
    // compact: fibonacci sphere
    const y = 1 - (i / Math.max(N - 1, 1)) * 2;
    const rr = Math.sqrt(1 - y * y);
    const th = golden * i;
    const R = 7.6 + rand(-0.5, 0.5);
    const compact = new THREE.Vector3(Math.cos(th) * rr * R, y * R * 0.85, Math.sin(th) * rr * R);
    // galaxy: along spiral arms
    const arm = i % ARMS;
    const r = 6 + (i / N) * 15 + rand(-1, 1);
    const ang = (arm / ARMS) * Math.PI * 2 + r * ARM_TWIST + rand(-0.15, 0.15);
    const galaxy = new THREE.Vector3(Math.cos(ang) * r, rand(-0.4, 1.2), Math.sin(ang) * r);
    mesh.userData = { compact, galaxy, seed: Math.random() * 10, index: i, src, canvas: pc, hover: 0, sx: 1, sy: 1 };
    world.add(mesh);
    photos.push(mesh);
  });
}

// ---------------------------------------------------------------- wishes in space
const wishSprites = [];
await Promise.race([
  Promise.all([document.fonts.load('700 64px "Dancing Script"'), document.fonts.load('600 38px "Be Vietnam Pro"')]),
  new Promise((r) => setTimeout(r, 2500)),
]);
{
  const list = wishes.slice(0, 14);
  const n = list.length;
  list.forEach((text, i) => {
    const tex = makeTextTexture(text);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
    const a = (i / n) * Math.PI * 2;
    const compact = new THREE.Vector3(Math.cos(a) * 12.5, (i % 2 ? 1 : -1) * rand(2, 5), Math.sin(a) * 12.5);
    const arm = i % ARMS;
    const r = 9 + (i / n) * 13;
    const ang = (arm / ARMS) * Math.PI * 2 + r * ARM_TWIST + Math.PI / ARMS;
    const galaxy = new THREE.Vector3(Math.cos(ang) * r, rand(1.5, 3), Math.sin(ang) * r);
    s.userData = { compact, galaxy, seed: Math.random() * 10, w: tex.userData.w * 0.0085, h: tex.userData.h * 0.0085 };
    s.renderOrder = 2;
    world.add(s);
    wishSprites.push(s);
  });
}
// texts were drawn before the fonts finished on slow connections: redraw photo labels once ready
document.fonts.ready.then(() => photos.forEach((p) => !p.userData.src && (p.material.map.needsUpdate = true)));

// ---------------------------------------------------------------- state
const state = {
  started: false,
  expand: 0,
  expandTarget: 0,
  spin: 0,
  tilt: 0,
  tiltTarget: 0,
  zoomTarget: null,
  modalOpen: false,
  modalOpenedAt: 0,
  lastWishAt: 0,
  pointPhoto: null,
  pointSince: 0,
  handBase: null,
};
const hands = new HandController($('#cam'), $('#cam-overlay'));

// ---------------------------------------------------------------- UI
$('#intro-title').textContent = CONFIG.title;
$('#intro-sub').textContent = CONFIG.subtitle;
$('#hud-title span').textContent = CONFIG.title;
if (matchMedia('(pointer: coarse)').matches) $('#btn-start-touch').textContent = '✨ Dùng cảm ứng';
else $('#btn-start-touch').textContent = '✨ Dùng chuột';
document.title = CONFIG.title;

const toastEl = $('#toast');
let toastTimer;
function toast(text, info = false, ms = 3200) {
  toastEl.textContent = text;
  toastEl.classList.toggle('info', info);
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

function setExpand(v) {
  state.expandTarget = v;
  $('#btn-toggle').textContent = v > 0.5 ? '💫 Thu về' : '🌌 Bung thiên hà';
}

// music: "builtin" = the synthesized birthday song, a path = an audio file, "" = silence
function filePlayer(src, startAt = 0) {
  let a;
  let retries = 0;
  const make = (url) => {
    a = new Audio(url);
    a.loop = true;
    a.volume = 0.7;
    a.preload = 'auto';
    a.addEventListener('playing', () => $('#btn-music').classList.add('active'));
    a.addEventListener('pause', () => $('#btn-music').classList.remove('active'));
    a.addEventListener('error', () => console.warn('Không tải được nhạc:', url));
    if (startAt) a.addEventListener('loadedmetadata', () => (a.currentTime = startAt), { once: true });
  };
  make(src);
  return {
    play() {
      // a load that failed earlier (e.g. a 404 the browser cached) gets a fresh, uncached retry
      if (a.error && retries++ < 2) make(`${src}${src.includes('?') ? '&' : '?'}r=${Date.now()}`);
      return a.play();
    },
    pause: () => a.pause(),
    get playing() { return !a.paused; },
  };
}
const music = CONFIG.music === 'builtin' ? new BirthdaySong() : CONFIG.music ? filePlayer(CONFIG.music, CONFIG.musicStart) : null;
let musicWanted = false;
let musicRetryArmed = false;
function playMusic() {
  // must run inside a tap/click: browsers only allow sound to start from a user gesture
  musicWanted = true;
  Promise.resolve(music.play())
    .then(() => $('#btn-music').classList.add('active'))
    .catch((err) => {
      console.warn('Chưa phát được nhạc:', err);
      $('#btn-music').classList.remove('active');
      if (musicRetryArmed) return;
      // blocked or not loaded yet: the next tap anywhere tries again
      musicRetryArmed = true;
      toast('🎵 Chạm vào màn hình để bật nhạc', true, 4000);
      const retry = () => {
        musicRetryArmed = false;
        removeEventListener('pointerdown', retry, true);
        if (musicWanted && !music.playing) playMusic();
      };
      addEventListener('pointerdown', retry, true);
    });
}
if (music) {
  $('#btn-music').classList.remove('hidden');
  $('#btn-music').onclick = () => {
    if (music.playing) {
      musicWanted = false;
      music.pause();
      $('#btn-music').classList.remove('active');
    } else playMusic();
  };
}

function start(withHands) {
  if (state.started) return;
  state.started = true;
  $('#intro').classList.add('fade');
  setTimeout(() => $('#intro').classList.add('hidden'), 800);
  $('#hud-title').classList.remove('hidden');
  $('#controls').classList.remove('hidden');
  if (music) playMusic();
  if (withHands) startHands();
  else setTimeout(() => setExpand(1), 1200);
}
$('#btn-start-hand').onclick = () => start(true);
$('#btn-start-touch').onclick = () => start(false);
$('#btn-toggle').onclick = () => setExpand(state.expandTarget > 0.5 ? 0 : 1);
$('#btn-help').onclick = () => $('#help').classList.toggle('hidden');
$('#btn-help-close').onclick = () => $('#help').classList.add('hidden');
$('#btn-cam').onclick = () => (hands.running ? stopHands() : startHands());

async function startHands() {
  $('#cam-box').classList.remove('hidden');
  $('#gesture-label').textContent = 'Đang tải mô hình…';
  $('#btn-cam').classList.add('active');
  try {
    await hands.start();
    // some phones pause page audio when the camera opens: pick the song back up
    if (musicWanted && !music.playing) Promise.resolve(music.play()).catch(() => {});
    $('#gesture-label').textContent = 'Đưa tay vào khung hình';
    toast('🖐 Xoè tay để bung thiên hà, ✊ nắm tay để thu lại', true, 4500);
  } catch (err) {
    console.error(err);
    stopHands();
    toast(
      err?.name === 'NotAllowedError'
        ? 'Bạn chưa cho phép camera — vẫn có thể dùng chuột / cảm ứng'
        : 'Không bật được camera trên thiết bị này — dùng chuột / cảm ứng nhé',
      true, 5000
    );
    setExpand(1);
  }
}
function stopHands() {
  hands.stop();
  $('#cam-box').classList.add('hidden');
  $('#finger').classList.add('hidden');
  $('#btn-cam').classList.remove('active');
  state.zoomTarget = null;
}

// ---------------------------------------------------------------- modal
function openModal(mesh) {
  const { src, canvas: pc, index } = mesh.userData;
  $('#modal-img').src = src || pc.toDataURL('image/png');
  $('#modal-wish').textContent = wishes[index % wishes.length];
  $('#modal').classList.remove('hidden');
  state.modalOpen = true;
  state.modalOpenedAt = performance.now();
}
function closeModal() {
  $('#modal').classList.add('hidden');
  state.modalOpen = false;
}
$('#modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal' || e.target.classList.contains('modal-close')) closeModal();
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
  if (e.key === ' ' && state.started && !state.modalOpen) {
    e.preventDefault();
    setExpand(state.expandTarget > 0.5 ? 0 : 1);
  }
});

// ---------------------------------------------------------------- picking
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(clientX, clientY) {
  ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObjects(photos, false)[0]?.object || null;
}
let hovered = null;
let down = null;
canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY, t: performance.now() }));
canvas.addEventListener('pointerup', (e) => {
  if (!down || !state.started) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  if (moved < 8 && performance.now() - down.t < 500) {
    const hit = pick(e.clientX, e.clientY);
    if (hit) openModal(hit);
  }
  down = null;
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || !state.started) return;
  hovered = pick(e.clientX, e.clientY);
  canvas.style.cursor = hovered ? 'pointer' : 'grab';
});
canvas.addEventListener('dblclick', () => state.started && setExpand(state.expandTarget > 0.5 ? 0 : 1));
let lastTap = 0;
canvas.addEventListener('touchend', (e) => {
  if (e.changedTouches.length !== 1 || !state.started) return;
  const now = performance.now();
  if (now - lastTap < 300) setExpand(state.expandTarget > 0.5 ? 0 : 1);
  lastTap = now;
});

// ---------------------------------------------------------------- hand gestures
const GESTURE_TEXT = {
  open: '🖐 Bung thiên hà',
  fist: '✊ Thu về',
  victory: '✌️ Lời chúc',
  point: '☝️ Chỉ vào ảnh',
  partial: '🤚',
  none: 'Đưa tay vào khung hình',
};
const fingerEl = $('#finger');
let lastLabel = '';
const fingerPos = { x: 0, y: 0 };

function applyHands(now, dt) {
  if (!hands.running) return;
  const h = hands.update(now);
  const label = GESTURE_TEXT[h.gesture] || '';
  if (label !== lastLabel) $('#gesture-label').textContent = lastLabel = label; // avoid a DOM write every frame

  if (!h.present) {
    state.handBase = null;
    fingerEl.classList.add('hidden');
    state.pointPhoto = null;
    return;
  }

  if (state.modalOpen) {
    fingerEl.classList.add('hidden');
    if (now - state.modalOpenedAt > 1200 && (h.gesture === 'fist' || h.gesture === 'open')) closeModal();
    return;
  }

  // zoom: compare palm size against the moment the hand appeared
  const dist = camera.position.distanceTo(controls.target);
  if (!state.handBase) state.handBase = { palm: h.palm, dist };
  state.zoomTarget = clamp(state.handBase.dist * Math.pow(state.handBase.palm / h.palm, 1.6), 9, 70);

  if (h.gesture === 'point') {
    // finger cursor -> hold over a photo to open it
    const tx = clamp((h.tip.x - 0.15) / 0.7, 0, 1) * innerWidth;
    const ty = clamp((h.tip.y - 0.12) / 0.6, 0, 1) * innerHeight;
    // detections arrive at ~25 Hz: glide the cursor between them
    const fresh = fingerEl.classList.contains('hidden');
    const sx = (fingerPos.x = fresh ? tx : damp(fingerPos.x, tx, 18, dt));
    const sy = (fingerPos.y = fresh ? ty : damp(fingerPos.y, ty, 18, dt));
    fingerEl.classList.remove('hidden');
    fingerEl.style.transform = `translate(${sx}px, ${sy}px)`;
    const hit = pick(sx, sy);
    if (hit !== state.pointPhoto) {
      state.pointPhoto = hit;
      state.pointSince = now;
    }
    hovered = hit;
    const p = hit ? clamp((now - state.pointSince) / 1100, 0, 1) : 0;
    fingerEl.style.setProperty('--p', p.toFixed(3));
    if (hit && p >= 1) {
      openModal(hit);
      state.pointPhoto = null;
    }
    return;
  }
  fingerEl.classList.add('hidden');
  if (state.pointPhoto) hovered = null;
  state.pointPhoto = null;

  if (h.gesture === 'victory') {
    if (now - state.lastWishAt > 3000) {
      state.lastWishAt = now;
      toast('💌 ' + wishes[Math.floor(Math.random() * wishes.length)]);
    }
  } else {
    setExpand(h.openness);
  }

  // rotate by moving the hand (like dragging the galaxy)
  state.spin += h.dx * 7;
  state.tiltTarget = clamp(state.tiltTarget + h.dy * 3, -0.6, 0.8);
}

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
const invQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const offset = new THREE.Vector3();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const now = performance.now();

  applyHands(now, dt);

  state.expand = damp(state.expand, state.expandTarget, 2.2, dt);
  const e = smooth(clamp(state.expand, 0, 1));
  galaxyMat.uniforms.uExpand.value = state.expand;
  galaxyMat.uniforms.uTime.value = t;
  orbMat.uniforms.uTime.value = t;

  // world rotation: slow auto spin + hand impulses
  const spinStep = state.spin * Math.min(1, dt * 6);
  state.spin -= spinStep;
  world.rotation.y += dt * 0.07 + spinStep;
  state.tilt = damp(state.tilt, state.tiltTarget, 4, dt);
  world.rotation.x = state.tilt;

  // camera zoom driven by hand
  if (state.zoomTarget != null) {
    offset.copy(camera.position).sub(controls.target);
    const d = damp(offset.length(), state.zoomTarget, 3, dt);
    camera.position.copy(controls.target).addScaledVector(offset.normalize(), d);
  }

  // core
  const pulse = 1 + Math.sin(t * 1.1) * 0.025;
  orb.scale.setScalar((1 - e * 0.35) * pulse);
  glowBig.scale.setScalar((9 + e * 5) * pulse);
  glowSmall.scale.setScalar(2.4 + e * 1.2);

  // photos always face the camera
  invQ.copy(world.quaternion).invert().multiply(camera.quaternion);
  for (const p of photos) {
    const u = p.userData;
    const k = clamp(e * 1.2 - (u.index / photos.length) * 0.2, 0, 1);
    tmpV.lerpVectors(u.compact, u.galaxy, smooth(k));
    tmpV.y += Math.sin(t * 0.8 + u.seed) * 0.18;
    p.position.copy(tmpV);
    p.quaternion.copy(invQ);
    u.hover = damp(u.hover, p === hovered ? 1 : 0, 10, dt);
    const sc = (1.9 + e * 0.7) * (1 + u.hover * 0.3) * view.photoScale;
    p.scale.set(sc * u.sx, sc * u.sy, 1);
  }
  for (const s of wishSprites) {
    const u = s.userData;
    tmpV.lerpVectors(u.compact, u.galaxy, e);
    tmpV.y += Math.sin(t * 0.6 + u.seed) * 0.3;
    s.position.copy(tmpV);
    const k = (1 + e * 0.35) * view.wishScale;
    s.scale.set(u.w * k, u.h * k, 1);
    s.material.opacity = 0.9 + 0.1 * Math.sin(t * 0.7 + u.seed);
  }

  stars.rotation.y += dt * 0.004;

  controls.update();
  composer.render();
  adaptQuality(now);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// Drop the render resolution step by step while the GPU can't hold ~50 fps.
// Each resolution change re-creates the render targets and shows as a flash, so this
// steps down at most once, straight to 1x, and only after two slow windows in a row.
const perf = { last: 0, frames: 0, slow: 0, strikes: 0, done: false, since: performance.now() + 3000 };
function adaptQuality(now) {
  const ft = now - perf.last;
  perf.last = now;
  if (perf.done || now < perf.since || ft > 200 || document.hidden) return; // startup, tab switches
  perf.frames++;
  if (ft > 22) perf.slow++;
  if (perf.frames < 120) return;
  perf.strikes = perf.slow / perf.frames > 0.3 ? perf.strikes + 1 : 0;
  perf.frames = perf.slow = 0;
  if (perf.strikes >= 2 && renderer.getPixelRatio() > 1) {
    setPixelRatio(1);
    perf.done = true;
  }
}
function setPixelRatio(pr) {
  renderer.setPixelRatio(pr);
  composer.setPixelRatio(pr);
  galaxyMat.uniforms.uScale.value = pr * 95;
  perf.since = performance.now() + 1500; // let the new size settle before judging again
}

// phones fire bursts of resize events (address bar, rotation): resize once they settle
let resizeTimer;
const lastSize = { w: innerWidth, h: innerHeight };
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const w = innerWidth, h = innerHeight;
    if (w === lastSize.w && h === lastSize.h) return;
    Object.assign(lastSize, { w, h });
    const wasPortrait = view.portrait;
    const pos = fitView();
    if (view.portrait !== wasPortrait) camera.position.copy(pos); // phone rotated: reframe
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  }, 150);
});
