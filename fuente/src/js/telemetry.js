import { $, $$, svgEl } from './util.js';
import { sound } from './sound.js';

// Contador de rodillos: cada cifra es una tira 0–9 (dos vueltas) que se desplaza con --n
function odometer(el) {
  const to = el.dataset.to;
  el.textContent = '';
  if (el.dataset.pre) el.append(el.dataset.pre);
  const cols = [];
  for (const d of to) {
    const dg = document.createElement('span');
    dg.className = 'dg';
    const strip = document.createElement('span');
    for (let k = 0; k < 20; k++) {
      const n = document.createElement('span');
      n.textContent = String(k % 10);
      strip.appendChild(n);
    }
    strip.style.transform = 'translateY(calc(var(--n, 0) * -1em))';
    dg.appendChild(strip);
    el.appendChild(dg);
    cols.push({ strip, final: 10 + Number(d) });
  }
  if (el.dataset.suf) el.append(el.dataset.suf);
  return cols;
}

// X05 · Telemetría con instrumentos: aguja, reloj de 24 h, 25 puntos que se funden en 1 y anillo completo
export function initTelemetry({ gsap, ScrollTrigger, motion }) {
  const section = $('#telemetria');
  // Marcas de los diales
  const ticks = $('[data-gauge="drop"] .g-ticks', section);
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI + (i / 10) * Math.PI;
    const r1 = 92, r2 = i % 5 === 0 ? 100 : 97;
    svgEl('line', { x1: 100 + Math.cos(a) * r1, y1: 110 + Math.sin(a) * r1, x2: 100 + Math.cos(a) * r2, y2: 110 + Math.sin(a) * r2 }, ticks);
  }
  const cticks = $('.g-ticks-c', section);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r1 = i % 6 === 0 ? 34 : 38, r2 = 42;
    svgEl('line', { x1: 100 + Math.cos(a) * r1, y1: 62 + Math.sin(a) * r1, x2: 100 + Math.cos(a) * r2, y2: 62 + Math.sin(a) * r2 }, cticks);
  }
  const merge = $('#gMerge', section);
  const dots = [];
  for (let i = 0; i < 25; i++) {
    const cx = 40 + (i % 5) * 30;
    const cy = 22 + Math.floor(i / 5) * 20;
    dots.push(svgEl('circle', { cx, cy, r: 3.4 }, merge));
  }
  const odos = $$('.odo', section).map(odometer);

  const drop = $('#gDrop');
  const needle = $('#gNeedle');
  const clock = $('#gClock');
  const hand = $('#gHand');
  const ring = $('#gRing');
  const check = $('#gCheck');
  const one = $('#gOne');
  const finalState = () => {
    drop.style.strokeDashoffset = '80';
    needle.style.transform = 'rotate(-54deg)';
    clock.style.strokeDashoffset = '8';
    hand.style.transform = 'rotate(331deg)';
    ring.style.strokeDashoffset = '0';
    check.style.strokeDashoffset = '0';
    dots.forEach((d) => { d.style.opacity = '0'; });
    odos.forEach((cols) => cols.forEach((c) => c.strip.style.setProperty('--n', c.final)));
  };
  if (!motion) { finalState(); return; }

  gsap.set(drop, { strokeDashoffset: 0 });
  gsap.set(needle, { rotate: 90, svgOrigin: '100 110' });
  gsap.set(clock, { strokeDashoffset: 100 });
  gsap.set(hand, { rotate: 0, svgOrigin: '100 62' });
  gsap.set(ring, { strokeDashoffset: 100 });
  gsap.set(check, { strokeDashoffset: 100 });
  gsap.set(one, { scale: 0, svgOrigin: '100 62' });
  const tl = gsap.timeline({ paused: true });
  tl.to(drop, { strokeDashoffset: 80, duration: 1.8, ease: 'power3.inOut' }, 0.1);
  tl.to(needle, { rotate: -54, duration: 1.8, ease: 'power3.inOut' }, 0.1);
  tl.to(clock, { strokeDashoffset: 8, duration: 1.6, ease: 'power2.out' }, 0.2);
  tl.to(hand, { rotate: 331, duration: 1.6, ease: 'power2.out' }, 0.2);
  dots.forEach((d, i) => {
    tl.to(d, { attr: { cx: 100, cy: 62 }, opacity: 0, duration: 0.9, ease: 'power2.in' }, 0.3 + (i % 7) * 0.08 + Math.floor(i / 5) * 0.05);
  });
  tl.to(one, { scale: 1, duration: 0.7, ease: 'back.out(3)' }, 1.3);
  tl.to(ring, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' }, 0.3);
  tl.to(check, { strokeDashoffset: 0, duration: 0.5, ease: 'power2.out' }, 1.5);
  odos.forEach((cols, k) => cols.forEach((c, j) => {
    tl.to(c.strip, { '--n': c.final, duration: 1.4 + j * 0.25, ease: 'power3.out' }, 0.2 + k * 0.08);
  }));
  tl.call(() => sound.chord(), null, 1.6);
  ScrollTrigger.create({ trigger: section, start: 'top 75%', once: true, onEnter: () => { tl.play(); sound.tick(); } });
}
