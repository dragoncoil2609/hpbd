// "Happy Birthday" (public-domain melody) arranged as a slow, sweet music-box waltz,
// synthesized live with Web Audio: no audio file to download.
const BPM = 74;
const LOOP_BEATS = 30;
const LOOKAHEAD = 1.5; // seconds scheduled ahead, so throttled background timers don't cause gaps

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const jitter = (amt) => (Math.random() * 2 - 1) * amt;

// [beat, midi, length in beats]; beat 0 is the pickup "Hap-py"
const MELODY = [
  [0, 67, 0.75], [0.75, 67, 0.25],
  [1, 69, 1], [2, 67, 1], [3, 72, 1],
  [4, 71, 2], [6, 67, 0.75], [6.75, 67, 0.25],
  [7, 69, 1], [8, 67, 1], [9, 74, 1],
  [10, 72, 2], [12, 67, 0.75], [12.75, 67, 0.25],
  [13, 79, 1], [14, 76, 1], [15, 72, 1],
  [16, 71, 1], [17, 69, 1], [18, 77, 0.75], [18.75, 77, 0.25],
  [19, 76, 1], [20, 72, 1], [21, 74, 1],
  [22, 72, 3],
];

// name -> [bass, upper voicing]
const CHORDS = {
  C: [48, [52, 55, 60]],
  G7: [43, [53, 59, 62]],
  C7: [48, [52, 58, 60]],
  F: [41, [57, 60, 65]],
  Fmaj7: [41, [57, 60, 64]],
  G: [43, [55, 59, 62]],
};

// [beat, chord, length in beats]; beats 25-30 are a little music-box interlude
const PROGRESSION = [
  [1, 'C', 3], [4, 'G7', 3], [7, 'G7', 3], [10, 'C', 3], [13, 'C7', 3], [16, 'F', 3],
  [19, 'C', 2], [21, 'G7', 1], [22, 'C', 3], [25, 'Fmaj7', 3], [28, 'G', 2],
];
const INTERLUDE = [
  [25, 77], [25.5, 81], [26, 84], [26.5, 88], [27, 84], [27.5, 81],
  [28, 79], [28.5, 83], [29, 86], [29.5, 91],
];

// ---------------------------------------------------------------- voices
function envGain(ctx, out) {
  const g = ctx.createGain();
  g.connect(out);
  return g;
}

// soft, slightly breathy lead with a delayed vibrato
function lead(s, t, midi, beats) {
  const { ctx } = s;
  const f = mtof(midi);
  const end = t + beats * s.spb;
  const env = envGain(ctx, s.bus);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(0.13, t + 0.05);
  env.gain.exponentialRampToValueAtTime(0.08, end);
  env.gain.exponentialRampToValueAtTime(0.0001, end + 0.7);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2000;
  lp.connect(env);

  const o1 = ctx.createOscillator();
  o1.type = 'triangle';
  o1.frequency.value = f;
  o1.connect(lp);
  const o2 = ctx.createOscillator();
  o2.frequency.value = f * 2;
  const g2 = ctx.createGain();
  g2.gain.value = 0.2;
  o2.connect(g2).connect(lp);

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5;
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(f * 0.006, t + 0.45);
  lfo.connect(depth).connect(o1.frequency);

  for (const o of [o1, o2, lfo]) {
    o.start(t);
    o.stop(end + 0.75);
  }
}

// music-box tine: bright attack, long ring
function bell(s, t, midi, vel) {
  const { ctx } = s;
  const f = mtof(midi);
  for (const [mult, amp, decay] of [[1, 1, 1.9], [2, 0.22, 0.9], [4.02, 0.08, 0.35]]) {
    const g = envGain(ctx, s.bus);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel * amp, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    const o = ctx.createOscillator();
    o.frequency.value = f * mult;
    o.connect(g);
    o.start(t);
    o.stop(t + decay + 0.05);
  }
}

function bass(s, t, midi, beats) {
  const { ctx } = s;
  const end = t + beats * s.spb;
  const g = envGain(ctx, s.bus);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.06, end);
  g.gain.exponentialRampToValueAtTime(0.0001, end + 0.5);
  const o = ctx.createOscillator();
  o.frequency.value = mtof(midi);
  o.connect(g);
  o.start(t);
  o.stop(end + 0.55);
}

// waltz "pa-pa" on beats 2 and 3: soft electric-piano-ish chord
function keys(s, t, notes) {
  for (const m of notes) {
    const { ctx } = s;
    const tt = t + Math.abs(jitter(0.012));
    const f = mtof(m);
    const g = envGain(ctx, s.bus);
    g.gain.setValueAtTime(0.0001, tt);
    g.gain.exponentialRampToValueAtTime(0.035 * (1 + jitter(0.15)), tt + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, tt + 1.3);
    for (const [mult, amp] of [[1, 1], [2, 0.3]]) {
      const o = ctx.createOscillator();
      o.frequency.value = f * mult;
      const a = ctx.createGain();
      a.gain.value = amp;
      o.connect(a).connect(g);
      o.start(tt);
      o.stop(tt + 1.35);
    }
  }
}

// warm string-like pad underneath
function pad(s, t, notes, beats) {
  const { ctx } = s;
  const end = t + beats * s.spb;
  const env = envGain(ctx, s.bus);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(0.022, t + 0.9);
  env.gain.setValueAtTime(0.022, end);
  env.gain.linearRampToValueAtTime(0.0001, end + 1.4);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 750;
  lp.connect(env);
  for (const m of notes) {
    for (const cents of [-7, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(m);
      o.detune.value = cents;
      o.connect(lp);
      o.start(t);
      o.stop(end + 1.5);
    }
  }
}

function impulse(ctx, seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

// every other pass the lead rests and the music box carries the tune
function buildLoop(loop) {
  const solo = loop % 2 === 1;
  const ev = [];
  for (const [b, m, d] of MELODY) {
    if (!solo) ev.push({ b, fn: (s, t) => lead(s, t, m, d) });
    ev.push({ b, fn: (s, t) => bell(s, t, m + 12, solo ? 0.13 : 0.04) });
  }
  for (const [b, name, d] of PROGRESSION) {
    const [root, upper] = CHORDS[name];
    ev.push({ b, fn: (s, t) => (bass(s, t, root, d), pad(s, t, upper, d)) });
    for (let k = 1; k < d; k++) ev.push({ b: b + k, fn: (s, t) => keys(s, t, upper) });
  }
  for (const [b, m] of INTERLUDE) ev.push({ b, fn: (s, t) => bell(s, t, m, 0.06) });
  return ev.sort((x, y) => x.b - y.b);
}

// ---------------------------------------------------------------- player
export class BirthdaySong {
  constructor(volume = 0.6) {
    this.volume = volume;
    this.ctx = null;
    this.playing = false;
  }

  _init() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(comp);

    const verb = ctx.createConvolver();
    verb.buffer = impulse(ctx, 3.2, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.4;
    verb.connect(wet).connect(this.master);
    this.bus = ctx.createGain();
    this.bus.connect(this.master);
    this.bus.connect(verb);

    this.spb = 60 / BPM;
    this.loop = 0;
    this.idx = 0;
    this.events = buildLoop(0);
    this.loopStart = ctx.currentTime + 0.3;
  }

  // must be called from a user gesture (click/tap) the first time
  play() {
    if (!this.ctx) this._init();
    const { ctx } = this;
    this.playing = true;
    clearTimeout(this.suspendTimer);
    const resumed = ctx.resume();
    this._fade(this.volume, 1.6);
    if (!this.timer) this.timer = setInterval(() => this._schedule(), 200);
    this._schedule();
    return resumed;
  }

  pause() {
    if (!this.ctx) return;
    this.playing = false;
    this._fade(0, 0.4);
    clearTimeout(this.suspendTimer);
    this.suspendTimer = setTimeout(() => this.ctx.suspend(), 450);
  }

  _fade(to, secs) {
    const g = this.master.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(to, now + secs);
  }

  _schedule() {
    const { ctx } = this;
    const horizon = ctx.currentTime + LOOKAHEAD;
    for (;;) {
      if (this.idx >= this.events.length) {
        this.loop++;
        this.loopStart += LOOP_BEATS * this.spb;
        this.events = buildLoop(this.loop);
        this.idx = 0;
      }
      const ev = this.events[this.idx];
      const t = this.loopStart + ev.b * this.spb;
      if (t > horizon) break;
      if (t >= ctx.currentTime - 0.05) ev.fn(this, t);
      this.idx++;
    }
  }
}
