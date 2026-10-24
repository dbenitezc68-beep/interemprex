// Sonido sintetizado con Web Audio: no se descarga ningún archivo.
let ctx = null;
let master = null;
let enabled = false;
let noiseBuf = null;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.55;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp);
  comp.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

function env(node, t, a, peak, d) {
  node.gain.setValueAtTime(0.0001, t);
  node.gain.exponentialRampToValueAtTime(peak, t + a);
  node.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

export const sound = {
  get on() { return enabled; },
  async enable() {
    if (!ensure()) return false;
    try { await ctx.resume(); } catch (e) { return false; }
    enabled = true;
    return true;
  },
  disable() {
    enabled = false;
    if (ctx) ctx.suspend().catch(() => {});
  },
  beep(freq = 880, dur = 0.12, gain = 0.12) {
    if (!enabled) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    env(g, t, 0.005, gain, dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  },
  tick() {
    if (!enabled) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(2400, t);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.04);
    env(g, t, 0.002, 0.06, 0.05);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.08);
  },
  thump(intensity = 1) {
    if (!enabled) return;
    const t = ctx.currentTime;
    [[0, 62, 0.5], [0.16, 54, 0.32]].forEach(([dt, f, amp]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f * 1.8, t + dt);
      o.frequency.exponentialRampToValueAtTime(f, t + dt + 0.06);
      env(g, t + dt, 0.008, amp * intensity, 0.16);
      o.connect(g).connect(master);
      o.start(t + dt);
      o.stop(t + dt + 0.3);
    });
  },
  clank(pitch = 1) {
    if (!enabled) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600 * pitch;
    bp.Q.value = 3;
    const g = ctx.createGain();
    env(g, t, 0.002, 0.35, 0.18);
    n.connect(bp).connect(g).connect(master);
    n.start(t);
    n.stop(t + 0.3);
    [523, 1187, 1873].forEach((f, i) => {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f * pitch;
      env(og, t, 0.002, 0.08 / (i + 1), 0.5 - i * 0.1);
      o.connect(og).connect(master);
      o.start(t);
      o.stop(t + 0.7);
    });
    const thud = ctx.createOscillator();
    const tg = ctx.createGain();
    thud.frequency.setValueAtTime(140, t);
    thud.frequency.exponentialRampToValueAtTime(50, t + 0.12);
    env(tg, t, 0.003, 0.4, 0.14);
    thud.connect(tg).connect(master);
    thud.start(t);
    thud.stop(t + 0.25);
  },
  whoosh() {
    if (!enabled) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.8;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + 0.35);
    const g = ctx.createGain();
    env(g, t, 0.12, 0.18, 0.3);
    n.connect(f).connect(g).connect(master);
    n.start(t);
    n.stop(t + 0.6);
  },
  blip(freq = 1200, gain = 0.05) {
    if (!enabled) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.06);
    env(g, t, 0.003, gain, 0.08);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.12);
  },
  key() {
    if (!enabled) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 3200;
    const g = ctx.createGain();
    env(g, t, 0.001, 0.03, 0.025);
    n.connect(f).connect(g).connect(master);
    n.start(t, Math.random() * 0.4);
    n.stop(t + 0.04);
  },
  // Despegue: rugido grave que crece y se aleja
  launch(dur = 2.2) {
    if (!enabled) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = noiseBuf;
    n.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(120, t);
    lp.frequency.exponentialRampToValueAtTime(900, t + dur * 0.35);
    lp.frequency.exponentialRampToValueAtTime(160, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(lp).connect(g).connect(master);
    n.start(t);
    n.stop(t + dur + 0.1);
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(48, t);
    o.frequency.exponentialRampToValueAtTime(90, t + dur * 0.6);
    env(og, t, 0.2, 0.06, dur * 0.8);
    o.connect(og).connect(master);
    o.start(t);
    o.stop(t + dur);
  },
  chord() {
    if (!enabled) return;
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((fr, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = fr;
      env(g, t + i * 0.06, 0.01, 0.09, 0.6);
      o.connect(g).connect(master);
      o.start(t + i * 0.06);
      o.stop(t + i * 0.06 + 0.8);
    });
  },
};
