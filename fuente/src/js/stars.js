import { clamp, lerp } from './util.js';

// X03 · Cielo con gravedad y estela: estrellas en tres profundidades, atraídas por el cursor
// y estiradas en estelas cuando el scroll va rápido. Se apaga en la escena «plano».
export function initStars({ gsap, motion, getVelocity }) {
  const W = window;
  const html = document.documentElement;
  const canvas = document.getElementById('stars');
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1;
  let stars = [];
  const mouse = { x: -9999, y: -9999, on: false };
  let vel = 0;

  const seed = () => {
    const n = clamp(Math.round((w * h) / 5200), 110, 340);
    stars = Array.from({ length: n }, () => {
      const z = Math.random();
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        z: 0.25 + z * 0.75,
        r: 0.35 + z * z * 1.25,
        tw: Math.random() * Math.PI * 2,
        ts: 0.6 + Math.random() * 1.8,
        c: Math.random() < 0.18 ? '125,211,252' : Math.random() < 0.08 ? '167,139,250' : '226,238,252',
        ox: 0,
        oy: 0,
      };
    });
  };
  const resize = () => {
    dpr = Math.min(1.5, W.devicePixelRatio || 1);
    w = W.innerWidth;
    h = W.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    seed();
  };

  const draw = (time) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const sy = W.scrollY;
    const streak = clamp(Math.abs(vel) * 1.6, 0, 140) * Math.sign(vel);
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      let y = (s.y - sy * s.z * 0.18) % h;
      if (y < 0) y += h;
      const x = s.x;
      // Gravedad del cursor
      if (mouse.on) {
        const dx = mouse.x - x;
        const dy = mouse.y - y;
        const d = Math.hypot(dx, dy);
        const R = 170;
        const f = d < R ? Math.pow(1 - d / R, 2) * 0.32 : 0;
        s.ox = lerp(s.ox, dx * f, 0.12);
        s.oy = lerp(s.oy, dy * f, 0.12);
      } else {
        s.ox = lerp(s.ox, 0, 0.08);
        s.oy = lerp(s.oy, 0, 0.08);
      }
      const px = x + s.ox;
      const py = y + s.oy;
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * s.ts + s.tw)) * s.z;
      if (Math.abs(streak) > 3) {
        const len = streak * s.z;
        ctx.strokeStyle = `rgba(${s.c},${(a * 0.8).toFixed(3)})`;
        ctx.lineWidth = s.r * 1.2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py + len);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(${s.c},${a.toFixed(3)})`;
        ctx.fillRect(px - s.r / 2, py - s.r / 2, s.r, s.r);
      }
    }
  };

  resize();
  let rt = 0;
  W.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { resize(); if (!motion) draw(0); }, 120);
  });
  if (!motion) { draw(0); return; }

  W.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.on = true;
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { mouse.on = false; });
  gsap.ticker.add((time) => {
    if (document.hidden || html.dataset.scene === 'plano') return;
    vel = lerp(vel, getVelocity(), 1 - Math.pow(0.8, gsap.ticker.deltaRatio()));
    draw(time);
  });
}
