import { clamp, lerp, onResize } from './util.js';

// X03 · Cielo con gravedad y estela: estrellas en tres profundidades, atraídas por el puntero
// y estiradas en estelas cuando el scroll va rápido. Se apaga en la escena «plano».
// Se dibuja agrupado por color (un estilo por grupo y la transparencia como número) y, con la página quieta,
// a menos ritmo: el parpadeo es lento y no se nota la diferencia.
const COLORS = ['rgb(226,238,252)', 'rgb(125,211,252)', 'rgb(167,139,250)'];

export function initStars({ gsap, motion, fine, getScroll, getVelocity }) {
  const W = window;
  const html = document.documentElement;
  const canvas = document.getElementById('stars');
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1;
  let stars = [];
  const mouse = { x: -9999, y: -9999, on: false, at: -1e9 };
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
        c: Math.random() < 0.18 ? 1 : Math.random() < 0.08 ? 2 : 0,
        ox: 0,
        oy: 0,
      };
    }).sort((a, b) => a.c - b.c);
  };
  const resize = () => {
    dpr = Math.min(1.5, W.devicePixelRatio || 1);
    w = W.innerWidth;
    h = W.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    seed();
  };
  // Pantallas táctiles: el tamaño sale del propio lienzo (100lvh, no cambia con la barra de direcciones).
  // Si solo cambia el alto (navegadores sin lvh), las estrellas se estiran en lugar de sembrarse de nuevo.
  const fit = (cw, ch) => {
    const d = Math.min(1.5, W.devicePixelRatio || 1);
    if (cw === w && ch === h && d === dpr) return false;
    const keep = stars.length && cw === w;
    if (keep) stars.forEach((s) => { s.y *= ch / h; });
    dpr = d;
    w = cw;
    h = ch;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    if (!keep) seed();
    return true;
  };

  let lastT = 0;
  const draw = (time) => {
    // Las estrellas siguen al puntero con un suavizado por tiempo (se dibuja a ritmo variable)
    const r = lastT && time > lastT ? Math.min(6, (time - lastT) * 60) : 1;
    lastT = time;
    const kIn = 1 - Math.pow(0.88, r);
    const kOut = 1 - Math.pow(0.92, r);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const sy = getScroll();
    const streak = clamp(Math.abs(vel) * 1.6, 0, 140) * Math.sign(vel);
    const lines = Math.abs(streak) > 3;
    let c = -1;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      let y = (s.y - sy * s.z * 0.18) % h;
      if (y < 0) y += h;
      const x = s.x;
      // Gravedad del puntero
      if (mouse.on) {
        const dx = mouse.x - x;
        const dy = mouse.y - y;
        const d = Math.hypot(dx, dy);
        const R = 170;
        const f = d < R ? Math.pow(1 - d / R, 2) * 0.32 : 0;
        s.ox = lerp(s.ox, dx * f, kIn);
        s.oy = lerp(s.oy, dy * f, kIn);
      } else {
        s.ox = lerp(s.ox, 0, kOut);
        s.oy = lerp(s.oy, 0, kOut);
      }
      const px = x + s.ox;
      const py = y + s.oy;
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * s.ts + s.tw)) * s.z;
      if (s.c !== c) {
        c = s.c;
        if (lines) ctx.strokeStyle = COLORS[c];
        else ctx.fillStyle = COLORS[c];
      }
      if (lines) {
        ctx.globalAlpha = a * 0.8;
        ctx.lineWidth = s.r * 1.2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py + streak * s.z);
        ctx.stroke();
      } else {
        ctx.globalAlpha = a;
        ctx.fillRect(px - s.r / 2, py - s.r / 2, s.r, s.r);
      }
    }
    ctx.globalAlpha = 1;
  };

  let lastY = -1;
  if (!fine) {
    // Pantallas táctiles: se dibuja en cada fotograma solo mientras hay scroll; con la página quieta, el parpadeo
    // va a unos 15 dibujos por segundo con un temporizador, y entre uno y otro el procesador descansa
    fit(canvas.clientWidth, canvas.clientHeight);
    let raf = 0;
    let idle = 0;
    let lastF = 0;
    const frame = (now) => {
      raf = 0;
      if (off()) { rest(); return; }
      const r = lastF ? Math.min(6, (now - lastF) / 16.7) : 1;
      lastF = now;
      vel = lerp(vel, getVelocity(), 1 - Math.pow(0.8, r));
      const y = getScroll();
      const moving = y !== lastY || Math.abs(vel) > 0.05;
      lastY = y;
      draw(now / 1000);
      if (moving) raf = requestAnimationFrame(frame);
      else rest();
    };
    const wake = () => { clearTimeout(idle); if (!raf) raf = requestAnimationFrame(frame); };
    // En el plano (o con la pestaña oculta) no se dibuja: se mira de vez en cuando sin pedir fotogramas
    const off = () => document.hidden || html.dataset.scene === 'plano';
    const later = () => (off() ? rest() : wake());
    const rest = () => { clearTimeout(idle); idle = setTimeout(later, off() ? 400 : 66); };
    if (motion) {
      W.addEventListener('scroll', () => { if (!off()) wake(); }, { passive: true });
      wake();
    } else draw(0);
    onResize(canvas, (b) => {
      const box = b || canvas.getBoundingClientRect();
      if (fit(Math.round(box.width), Math.round(box.height))) draw(motion ? performance.now() / 1000 : 0);
    });
    return;
  }

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
    mouse.at = performance.now();
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { mouse.on = false; mouse.at = performance.now(); });
  let odd = false;
  gsap.ticker.add((time) => {
    if (document.hidden || html.dataset.scene === 'plano') return;
    vel = lerp(vel, getVelocity(), 1 - Math.pow(0.8, gsap.ticker.deltaRatio()));
    const y = getScroll();
    // Con scroll o puntero en marcha, cada fotograma; quieta, uno de cada dos
    const moving = y !== lastY || Math.abs(vel) > 0.05 || performance.now() - mouse.at < 1500;
    lastY = y;
    odd = !odd;
    if (!moving && odd) return;
    draw(time);
  });
}
