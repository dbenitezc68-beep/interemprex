import { $, $$, clamp, lerp, toLinear, easeOut } from './util.js';
import { GL, M4, box, sphere, torus, circle, loop } from './webgl.js';
import { sound } from './sound.js';
import { S } from './i18n.js';

// X02 · Sistema orbital 3D: el logotipo en el núcleo y los cuatro servicios como planetas
export const PLANETS = [
  { code: 'WEB', color: '#38bdf8', target: '#s-web', r: 1.55, size: 0.15, speed: 0.42, phase: 0.5 },
  { code: 'AUTO', color: '#22d3ee', target: '#s-auto', r: 2.05, size: 0.13, speed: 0.33, phase: 2.3 },
  { code: 'MKTG', color: '#a78bfa', target: '#s-mktg', r: 2.55, size: 0.15, speed: 0.26, phase: 4.0 },
  { code: 'INTL', color: '#2dd4bf', target: '#s-intl', r: 3.05, size: 0.18, speed: 0.2, phase: 5.4 },
].map((p, i) => ({ ...p, title: S.hero.planets[i][0], sub: S.hero.planets[i][1] }));

// Paneles del logotipo: dos bloques, cara frontal clara y cara lateral oscura (como el logo plano)
const T = 0.04;
const LOGO = [
  { s: [0.42, 1.0, T], p: [-0.31, -0.12, 0], c: '#3b7cc9', front: true },
  { s: [T, 0.7, 0.45], p: [-0.52, 0.03, -0.225], c: '#163f6c' },
  { s: [0.54, 1.78, T], p: [0.45, 0.03, -0.25], c: '#3b7cc9', front: true },
  { s: [T, 0.4, 0.5], p: [0.18, 0.72, -0.5], c: '#163f6c' },
];

function splitLine(el) {
  const text = el.dataset.text || '';
  el.textContent = '';
  const out = [];
  for (const ch of text) {
    const s = document.createElement('span');
    s.className = 'ch';
    s.textContent = ch === ' ' ? ' ' : ch;
    el.appendChild(s);
    out.push(s);
  }
  return out;
}

export function initHero({ gsap, motion, go }) {
  const W = window;
  const html = document.documentElement;
  const section = $('#despegue');
  const canvas = $('#heroGL');
  const tip = $('#orbitTip');
  const labelsBox = $('#planetLabels');
  const labels = $$('span', labelsBox);
  const legend = $$('#heroLegend a');
  const lines = $$('.ht-line', section);
  const chars = lines.map(splitLine);

  // El degradado de «NEGOCIO» se reparte letra a letra para poder animarlas por separado
  const layoutGrad = () => {
    $$('.ht-grad', section).forEach((line) => {
      const chs = $$('.ch', line);
      if (!chs.length) return;
      const x0 = chs[0].offsetLeft;
      const last = chs[chs.length - 1];
      line.style.setProperty('--gw', last.offsetLeft + last.offsetWidth - x0 + 'px');
      chs.forEach((c) => c.style.setProperty('--gx', -(c.offsetLeft - x0) + 'px'));
    });
  };
  // El titular nunca se sale de la pantalla: si una línea no cabe (pantallas estrechas, textos más largos
  // en inglés), se reduce el cuerpo de letra lo justo
  const titleEl = $('#heroTitle');
  const fitTitle = () => {
    titleEl.style.fontSize = '';
    const room = titleEl.clientWidth;
    const widest = Math.max(...lines.map((l) => l.scrollWidth));
    if (room && widest > room + 1) titleEl.style.fontSize = ((parseFloat(getComputedStyle(titleEl).fontSize) * room) / widest).toFixed(1) + 'px';
  };
  const relayout = () => { fitTitle(); layoutGrad(); };
  relayout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);

  const st = { t: 0, mx: 0, my: 0, tmx: 0, tmy: 0, scroll: 0, hover: -1, intro: motion ? 0 : 1, speed: 1, dirty: true, aimY: null };
  // Altura de cámara para que el logotipo quede detrás del titular, mida lo que mida la pantalla
  const title = $('#heroTitle');
  const FOV = 0.5;
  const ctas = $('.hero-ctas', section);
  const legendBox = $('#heroLegend');
  const yIn = (el) => {
    let top = 0;
    for (let n = el; n && n !== section; n = n.offsetParent) top += n.offsetTop;
    return top;
  };
  const aim = (dist, portrait) => {
    const h = section.clientHeight || W.innerHeight;
    const cy = portrait
      ? (yIn(ctas) + ctas.offsetHeight + yIn(legendBox)) / 2
      : yIn(title) + title.offsetHeight * 0.5;
    const ndc = 1 - (2 * cy) / h;
    return -ndc * Math.tan(FOV / 2) * dist;
  };
  W.addEventListener('resize', () => { st.aimY = null; st.dirty = true; });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { st.aimY = null; st.dirty = true; });
  let gl = null;
  try { gl = new GL(canvas, { dprMax: 1.5 }); } catch (e) { html.classList.add('no-gl'); }

  const setHover = (i) => {
    if (st.hover === i) return;
    st.hover = i;
    st.dirty = true;
    legend.forEach((a, k) => a.classList.toggle('on', k === i));
    if (i >= 0) {
      const pl = PLANETS[i];
      tip.style.setProperty('--c', pl.color);
      $('.ot-k', tip).textContent = pl.code;
      $('.ot-t', tip).textContent = pl.title;
      $('.ot-s', tip).textContent = pl.sub;
      tip.classList.add('on');
      sound.blip(700 + i * 160, 0.035);
    } else {
      tip.classList.remove('on');
    }
    // Sobre un planeta, la mano del sistema indica que se puede pulsar
    section.classList.toggle('on-planet', i >= 0);
  };

  let screen = [];
  if (gl) {
    const g = gl.gl;
    const boxes = LOGO.map((p) => ({ ...p, mesh: gl.mesh(box(...p.s)), col: toLinear(p.c) }));
    const ball = gl.mesh(sphere(1, 36));
    const ring = gl.mesh(torus(1, 0.008, 120, 6));
    const orbit = gl.lineMesh(circle(180));
    const pcol = PLANETS.map((p) => toLinear(p.color));
    const blue = toLinear('#38bdf8');
    const orbitIdle = [0.22, 0.74, 0.97, 0.26];

    const frame = (dt) => {
      // Suavizado por tiempo, no por fotograma: igual a 30, 60 o 120 fotogramas por segundo
      const ease = motion ? 1 - Math.pow(0.94, dt * 60) : 1;
      if (motion) {
        st.speed = lerp(st.speed, st.hover >= 0 ? 0.22 : 1 + st.scroll * 2.4, ease);
        st.t += dt * st.speed;
      }
      st.mx = lerp(st.mx, st.tmx, ease);
      st.my = lerp(st.my, st.tmy, ease);
      gl.resize();
      const portrait = gl.aspect < 1;
      const k = portrait ? 0.7 : 1;
      const dist = portrait ? 8.6 : 7.6;
      const s = st.scroll;
      const intro = easeOut(clamp(st.intro, 0, 1));
      if (st.aimY == null) st.aimY = aim(dist, portrait);
      const eye = [st.mx * 0.7, st.aimY + 0.45 + s * 3.2 - st.my * 0.35, dist - s * 2.6];
      const target = [0, st.aimY - s * 0.9, 0];
      gl.envRot = st.t * 0.1;
      gl.begin(eye, target, FOV, 0.1, 40);
      const tilt = M4.chain(M4.rotZ(portrait ? -0.42 : -0.1), M4.rotX(0.3 + st.my * 0.05), M4.rotY(st.mx * 0.12));

      // Núcleo: el logotipo
      const yaw = 0.55 + Math.sin(st.t * 0.35) * 0.32 + st.mx * 0.35;
      const ls = k * (0.2 + 0.8 * intro) * (portrait ? 0.6 : 0.74);
      const logoM = M4.chain(M4.scale(ls, ls, ls), M4.rotY(yaw), M4.rotX(-0.06 + st.my * 0.08), M4.translate(-0.1, -0.03, 0.3));
      boxes.forEach((b) => {
        gl.draw(b.mesh, M4.chain(logoM, M4.translate(...b.p)), {
          color: b.col,
          rough: 0.36,
          metal: 0.28,
          emit: b.front ? [0.012, 0.03, 0.07] : [0.002, 0.008, 0.02],
        });
      });
      // Anillos del giroscopio
      [[0.95, 1.1, 0.4], [1.12, -0.7, 1.2]].forEach(([r, ax, az], i) => {
        const rk = k * (portrait ? 0.78 : 0.92);
        const m = M4.chain(M4.scale(rk, rk, rk), M4.rotZ(az + st.t * 0.15 * (i ? -1 : 1)), M4.rotX(ax + st.t * 0.22), M4.scale(r * intro, r * intro, r * intro));
        gl.draw(ring, m, { color: blue, rough: 0.2, emit: [0.15, 0.5, 0.75], alpha: 0.75 * intro });
      });

      // Planetas
      screen = [];
      PLANETS.forEach((p, i) => {
        const a = p.phase + st.t * p.speed;
        const r = p.r * k * (0.25 + 0.75 * intro);
        const local = [Math.cos(a) * r, 0, Math.sin(a) * r];
        const w = [
          tilt[0] * local[0] + tilt[4] * local[1] + tilt[8] * local[2],
          tilt[1] * local[0] + tilt[5] * local[1] + tilt[9] * local[2],
          tilt[2] * local[0] + tilt[6] * local[1] + tilt[10] * local[2],
        ];
        const hov = st.hover === i;
        const sz = p.size * k * (hov ? 1.45 : 1) * intro;
        gl.draw(ball, M4.chain(M4.translate(...w), M4.scale(sz, sz, sz), M4.rotY(st.t * 0.6)), {
          color: pcol[i],
          rough: 0.4,
          emit: pcol[i].map((c) => c * (hov ? 0.7 : 0.4)),
        });
        const pr = gl.project(w);
        screen.push({ x: pr[0], y: pr[1], r: (sz * gl.proj[5] / pr[2]) * gl.cssH * 0.5, w });
      });
      // Órbitas
      PLANETS.forEach((p, i) => {
        const r = p.r * k * (0.25 + 0.75 * intro);
        const hov = st.hover === i;
        const c = hov ? [...pcol[i].map((v) => Math.pow(v, 1 / 2.2)), 0.85] : orbitIdle;
        gl.line(orbit, M4.chain(tilt, M4.scale(r, r, r)), [c[0], c[1], c[2], c[3] * intro]);
      });
      // Halos
      gl.glow([0, 0.05 * k, 0], 2.3 * k * intro, [0.22, 0.6, 1], 0.32);
      screen.forEach((sp, i) => {
        const hov = st.hover === i;
        gl.glow(sp.w, PLANETS[i].size * k * (hov ? 7.5 : 5.2) * intro, pcol[i].map((v) => Math.pow(v, 1 / 2.2)), hov ? 0.8 : 0.5);
      });

      // Etiquetas y ficha
      labels.forEach((el, i) => {
        const sp = screen[i];
        el.style.transform = `translate3d(${(sp.x + sp.r + 8).toFixed(1)}px, ${(sp.y - 7).toFixed(1)}px, 0)`;
      });
      if (st.hover >= 0) {
        const sp = screen[st.hover];
        const right = sp.x < gl.cssW * 0.62;
        const tx = right ? sp.x + sp.r + 18 : sp.x - sp.r - 258;
        const ty = clamp(sp.y - 40, 80, gl.cssH - 150);
        tip.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
      }
      st.dirty = false;
    };

    if (motion) {
      loop(canvas, frame);
    } else {
      // Sin movimiento: un fotograma quieto que se vuelve a dibujar al pasar el cursor o al cambiar el tamaño
      st.t = 1.2;
      const redraw = () => requestAnimationFrame(() => frame(0));
      redraw();
      W.addEventListener('resize', redraw);
      setInterval(() => { if (st.dirty) frame(0); }, 120);
    }
    labelsBox.classList.add('on');
  }

  // Cursor: inclina el sistema y detecta planetas
  const hit = (x, y) => {
    let best = -1;
    let bd = Infinity;
    screen.forEach((sp, i) => {
      const d = Math.hypot(sp.x - x, sp.y - y);
      if (d < Math.max(sp.r * 2.4, 24) && d < bd) { bd = d; best = i; }
    });
    return best;
  };
  section.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    st.tmx = (e.clientX / W.innerWidth) * 2 - 1;
    st.tmy = (e.clientY / W.innerHeight) * 2 - 1;
    st.dirty = true;
    const overUi = e.target.closest('a, button');
    if (overUi && !overUi.closest('#heroLegend')) { if (st.hover >= 0 && !legend.includes(overUi)) setHover(-1); return; }
    if (overUi) return;
    const r = canvas.getBoundingClientRect();
    setHover(hit(e.clientX - r.left, e.clientY - r.top));
  }, { passive: true });
  section.addEventListener('pointerleave', () => { st.tmx = 0; st.tmy = 0; setHover(-1); });
  section.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    const r = canvas.getBoundingClientRect();
    const i = hit(e.clientX - r.left, e.clientY - r.top);
    if (i >= 0) { setHover(-1); go(PLANETS[i].target); }
  });
  legend.forEach((a, i) => {
    a.addEventListener('pointerenter', () => setHover(i));
    a.addEventListener('pointerleave', () => setHover(-1));
    a.addEventListener('focus', () => setHover(i));
    a.addEventListener('blur', () => setHover(-1));
  });
  W.addEventListener('resize', relayout);

  return {
    intro() {
      if (!motion) { st.intro = 1; return; }
      gsap.to(st, { intro: 1, duration: 2.2, ease: 'power3.out' });
      const tl = gsap.timeline();
      tl.from('.badge', { y: 18, opacity: 0, duration: 0.9, ease: 'expo.out' }, 0);
      chars.forEach((cs, li) => {
        tl.from(cs, { yPercent: 115, rotate: 8, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.045 }, 0.1 + li * 0.18);
      });
      tl.from('.hero-sub', { y: 20, opacity: 0, duration: 1, ease: 'expo.out' }, 0.55);
      tl.from('.hero-ctas > *', { y: 20, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08 }, 0.65);
      tl.from('#heroLegend li', { y: 16, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.06 }, 0.85);
      tl.from('.scroll-cue', { opacity: 0, duration: 1 }, 1.1);
    },
    scroll(p) { st.scroll = p; st.dirty = true; },
  };
}
