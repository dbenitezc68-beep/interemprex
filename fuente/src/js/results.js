import { $, $$, svgEl } from './util.js';
import { sound } from './sound.js';
import { S } from './i18n.js';

// X13 · Parches de misión (texto en anillo y relieve al pasar el cursor)
// X14 · Misiones apiladas: cada tarjeta se queda fija y la siguiente la tapa; su recreación se reproduce al llegar
export function initResults({ gsap, ScrollTrigger, motion, fine }) {
  const section = $('#resultados');
  const missions = $$('.mission', section);
  missions.forEach((m, i) => m.style.setProperty('--i', i));

  if (motion && fine) {
    $$('.patch', section).forEach((p) => {
      const svg = $('.patch-in', p);
      p.addEventListener('pointermove', (e) => {
        const r = p.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        svg.style.transform = `rotateY(${(x * 34).toFixed(1)}deg) rotateX(${(-y * 34).toFixed(1)}deg) scale(1.04)`;
      });
      p.addEventListener('pointerleave', () => { svg.style.transform = ''; });
    });
  }

  // Recreación 1 · 25 proveedores que entran en un solo sistema
  const vm = $('.viz-merge', section);
  const linesG = $('.vm-lines', vm);
  const dotsG = $('.vm-dots', vm);
  const merge = [];
  for (let i = 0; i < 25; i++) {
    const x = 18 + (i % 5) * 32 + ((i * 37) % 11) - 5;
    const y = 18 + Math.floor(i / 5) * 40 + ((i * 53) % 13) - 6;
    const path = svgEl('path', { d: `M${x} ${y} C ${x + 70} ${y}, 190 100, 250 100`, pathLength: 100 }, linesG);
    const dot = svgEl('circle', { cx: x, cy: y, r: 4 }, dotsG);
    merge.push({ path, dot, x, y });
  }
  const core = $('.vm-core', vm);

  // Recreación 2 · tareas manuales antes y después
  const KIND = ['var(--teal)', 'var(--blue)', 'var(--violet)'];
  const before = $('#vbBefore');
  const after = $('#vbAfter');
  const mk = (parent, list) => list.map((k) => {
    const i = document.createElement('i');
    i.style.setProperty('--k', KIND[k]);
    parent.appendChild(i);
    return i;
  });
  const bBlocks = mk(before, [0, 0, 0, 0, 1, 1, 1, 2, 2, 2]);
  const aBlocks = mk(after, [0, 1]);

  // Recreación 3 · referencias rotas que se arreglan
  const rowsEl = $('#vtRows');
  const countEl = $('#vtCount');
  const rows = ['CON-01', 'CON-02', 'CON-03', 'CON-04', 'CON-05', 'CON-06'].map((c, i) => {
    const row = document.createElement('div');
    row.className = 'vt-row';
    row.innerHTML = `<span>${c}</span><span>${S.results.row(String.fromCharCode(65 + i))}</span><b>${S.results.broken}</b>`;
    rowsEl.appendChild(row);
    return row;
  });
  const fixAll = () => {
    rows.forEach((r) => { r.classList.add('ok'); $('b', r).textContent = S.results.fixed; });
    countEl.textContent = '0';
  };

  if (!motion) {
    merge.forEach((m) => { m.dot.setAttribute('cx', 250); m.dot.setAttribute('cy', 100); m.dot.style.opacity = '0'; });
    after.parentElement.style.opacity = '1';
    fixAll();
    return;
  }

  // Apilado: la tarjeta de debajo se encoge y se apaga cuando llega la siguiente
  missions.forEach((m, i) => {
    const next = missions[i + 1];
    if (!next) return;
    gsap.fromTo(m, { scale: 1, '--dim': 0 }, {
      scale: 0.93,
      '--dim': 0.62,
      ease: 'none',
      scrollTrigger: { trigger: next, start: 'top 75%', end: () => 'top ' + (parseFloat(getComputedStyle(next).top) || 120) + 'px', scrub: true, invalidateOnRefresh: true },
    });
  });

  const play = {
    merge() {
      const tl = gsap.timeline();
      merge.forEach((m) => { gsap.set(m.dot, { attr: { cx: m.x, cy: m.y }, opacity: 1 }); gsap.set(m.path, { strokeDasharray: 100, strokeDashoffset: 100 }); });
      tl.to(merge.map((m) => m.path), { strokeDashoffset: 0, duration: 0.8, stagger: 0.02, ease: 'power2.out' }, 0);
      merge.forEach((m, i) => {
        tl.to(m.dot, { attr: { cx: 250, cy: 100 }, opacity: 0, duration: 0.8, ease: 'power2.in' }, 0.6 + i * 0.045);
      });
      tl.fromTo(core, { scale: 1 }, { scale: 1.12, duration: 0.25, yoyo: true, repeat: 1, svgOrigin: '278 100', ease: 'power2.out' }, 1.9);
      tl.call(() => sound.blip(900, 0.04), null, 1.9);
      return tl;
    },
    bars() {
      const tl = gsap.timeline();
      tl.fromTo(bBlocks, { y: -60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: 'bounce.out' }, 0);
      tl.fromTo(aBlocks, { y: -60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.12, ease: 'bounce.out' }, 0.9);
      tl.fromTo(after.parentElement, { opacity: 0.35 }, { opacity: 1, duration: 0.4 }, 0.9);
      return tl;
    },
    table() {
      const tl = gsap.timeline();
      rows.forEach((r) => { r.classList.remove('ok', 'fixing'); $('b', r).textContent = S.results.broken; });
      countEl.textContent = String(rows.length);
      rows.forEach((r, i) => {
        tl.call(() => { r.classList.add('fixing'); }, null, 0.3 + i * 0.32);
        tl.call(() => {
          r.classList.remove('fixing');
          r.classList.add('ok');
          $('b', r).textContent = S.results.fixed;
          countEl.textContent = String(rows.length - i - 1);
          sound.tick();
        }, null, 0.5 + i * 0.32);
      });
      return tl;
    },
  };
  missions.forEach((m) => {
    let tl = null;
    ScrollTrigger.create({
      trigger: m,
      start: 'top 70%',
      onEnter: () => { if (tl) tl.kill(); tl = play[m.dataset.viz](); },
      onEnterBack: () => { if (tl) tl.progress(1); },
    });
  });
}
