import { $, $$, clamp, lerp, smooth, onVisible } from './util.js';
import { sound } from './sound.js';
import { S } from './i18n.js';

// Polígonos del logotipo (mismo dibujo que el símbolo SVG, caja 285 × 342)
const MARK = [
  { pts: [[5, 102], [62, 83], [62, 202], [5, 224]], c: [29, 82, 140] },
  { pts: [[62, 83], [134, 109], [134, 282], [62, 252]], c: [56, 150, 230] },
  { pts: [[102, 30], [187, 4], [187, 72], [102, 97]], c: [29, 82, 140] },
  { pts: [[187, 4], [280, 34], [280, 337], [187, 307]], c: [56, 189, 248] },
];
const CHAOS = [[248, 113, 113], [251, 191, 36], [148, 163, 184], [252, 165, 165], [203, 213, 225]];
// Paso de color: la transición caos → sistema se reparte en 16 tonos por partícula (no se aprecia la diferencia)
// y las partículas se pintan agrupadas por tono, con un solo estilo por grupo
const STEPS = 16;
const inPoly = (x, y, pts) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

// X07 · Del caos al sistema: partículas sueltas que se ordenan en el logotipo y su órbita
export function initChaos({ gsap, ScrollTrigger, motion }) {
  const section = $('#por-que');
  const box = $('#chaos');
  const canvas = $('#chaosCanvas');
  const ctx = canvas.getContext('2d');
  const bar = $('#chaosBar');
  const state = $('#chaosState');
  const chips = $$('.chaos-chips span', box);
  const pillars = $$('#pillars li');
  const range = $('#chaosRange');
  let W = 0, H = 0, dpr = 1;
  let parts = [];
  let p = motion ? 0 : 1;
  let time = 0;
  let visible = false;
  let lastStage = -1;
  let styles = [];
  let buckets = [];
  let drawnP = -1;

  const build = () => {
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    W = box.clientWidth;
    H = box.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const s = Math.min((W * 0.46) / 285, (H * 0.56) / 342);
    const ox = (W - 285 * s) / 2;
    const oy = (H - 342 * s) / 2 - H * 0.03;
    const g = Math.max(4.5, Math.round(W / 105));
    const targets = [];
    for (let y = 0; y < 342; y += g / s) {
      for (let x = 0; x < 285; x += g / s) {
        const f = MARK.find((m) => inPoly(x, y, m.pts));
        if (f) targets.push({ x: ox + x * s, y: oy + y * s, c: f.c });
      }
    }
    const N = W < 520 ? 560 : 1100;
    const ringN = Math.max(0, N - targets.length);
    const cx = ox + 142 * s;
    const cy = oy + 171 * s;
    const R = 342 * s * 0.68;
    const all = targets.slice(0, N);
    for (let i = 0; i < ringN; i++) {
      const a = (i / ringN) * Math.PI * 2;
      const rr = R * (i % 2 ? 1 : 1.12);
      all.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.36, c: i % 2 ? [34, 211, 238] : [167, 139, 250], ring: true });
    }
    // Una tabla de estilos por pareja de colores (caos → destino) y paso de la transición
    const pairs = new Map();
    styles = [];
    parts = all.map((t, i) => {
      const c = CHAOS[i % CHAOS.length];
      const key = c.join() + '>' + t.c.join();
      if (!pairs.has(key)) {
        pairs.set(key, styles.length);
        for (let k = 0; k <= STEPS; k++) {
          const f = k / STEPS;
          const col = c.map((v, j) => lerp(v, t.c[j], f) | 0);
          styles.push(`rgba(${col[0]},${col[1]},${col[2]},${(0.5 + 0.5 * f).toFixed(2)})`);
        }
      }
      return {
        tx: t.x,
        ty: t.y,
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        s0: pairs.get(key),
        d: (t.ring ? 0.35 : 0) + Math.random() * 0.4,
        z: 1 + Math.random() * 1.4,
      };
    });
    buckets = styles.map(() => []);
    drawnP = -1;
  };

  const draw = () => {
    // Con todas las partículas ya en el logotipo, el dibujo no cambia: no se repite
    const settled = p >= 0.84;
    if (settled && drawnP === p) return;
    drawnP = p;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < parts.length; i++) {
      const q = parts[i];
      // deriva del caos
      if (motion && !settled) {
        q.vx += (Math.random() - 0.5) * 0.08;
        q.vy += (Math.random() - 0.5) * 0.08;
        q.vx *= 0.97;
        q.vy *= 0.97;
        q.x += q.vx;
        q.y += q.vy;
        if (q.x < 0 || q.x > W) q.vx *= -1;
        if (q.y < 0 || q.y > H) q.vy *= -1;
      }
      const t = smooth(clamp((p - q.d * 0.55) / 0.42, 0, 1));
      q.px = lerp(q.x, q.tx, t);
      q.py = lerp(q.y, q.ty, t);
      q.sz = lerp(q.z, 2.2, t);
      buckets[q.s0 + Math.round(t * STEPS)].push(q);
    }
    for (let k = 0; k < buckets.length; k++) {
      const list = buckets[k];
      if (!list.length) continue;
      ctx.fillStyle = styles[k];
      ctx.beginPath();
      for (let j = 0; j < list.length; j++) {
        const q = list[j];
        ctx.rect(q.px - q.sz / 2, q.py - q.sz / 2, q.sz, q.sz);
      }
      ctx.fill();
      list.length = 0;
    }
  };

  const setP = (v) => {
    p = clamp(v, 0, 1);
    bar.style.transform = `scaleX(${p.toFixed(3)})`;
    const ok = p > 0.55;
    state.textContent = ok ? S.chaos.ok : S.chaos.bad;
    state.classList.toggle('ok', ok);
    const stage = p < 0.18 ? 0 : p < 0.45 ? 1 : p < 0.72 ? 2 : 3;
    if (motion) {
      pillars.forEach((li, i) => li.classList.toggle('on', stage >= i + 1));
      if (stage !== lastStage && stage > lastStage && stage > 0) sound.tick();
      chips.forEach((c, i) => {
        const k = clamp((p - i * 0.05) / 0.3, 0, 1);
        c.style.opacity = String(1 - k);
        c.style.transform = `translate3d(0, ${(-k * 30).toFixed(1)}px, 0) scale(${(1 - k * 0.3).toFixed(3)})`;
      });
    }
    lastStage = stage;
    if (!motion) draw();
  };

  build();
  if (!motion) {
    pillars.forEach((li) => li.classList.add('on'));
    range.value = '100';
    range.style.setProperty('--fill', '100%');
    range.addEventListener('input', () => {
      range.style.setProperty('--fill', range.value + '%');
      setP(Number(range.value) / 100);
    });
    setP(1);
    window.addEventListener('resize', () => { build(); draw(); });
    return;
  }

  setP(0);
  onVisible(box, (v) => { visible = v; });
  gsap.ticker.add((t) => {
    time = t;
    if (!visible) return;
    // pequeño temblor de las etiquetas mientras hay caos
    if (p < 0.5) chips.forEach((c, i) => { c.style.translate = `${(Math.sin(time * 1.3 + i) * 4).toFixed(1)}px ${(Math.cos(time * 1.1 + i * 2) * 3).toFixed(1)}px`; });
    draw();
  });
  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + window.innerHeight * 1.6,
    pin: $('.why-pin', section),
    scrub: 0.6,
    onUpdate: (s) => setP(s.progress * 1.12),
    onRefresh: () => build(),
  });
}
