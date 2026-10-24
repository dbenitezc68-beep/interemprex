import { $, $$, clamp, svgEl, pathSampler, onResize } from './util.js';
import { sound } from './sound.js';
import { S } from './i18n.js';

// X15 · Transición de escáner: una línea de luz pasa la página del espacio al plano técnico
export function initScan({ ScrollTrigger, motion }) {
  if (!motion) return;
  const sec = $('#escaner');
  const light = $('#scanLight');
  const line = $('#scanLine');
  const pct = $('#scanPct');
  let done = false;
  ScrollTrigger.create({
    trigger: sec,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (s) => {
      const p = s.progress;
      light.style.setProperty('--p', p.toFixed(4));
      line.style.setProperty('--p', p.toFixed(4));
      line.style.opacity = p > 0.995 || p < 0.005 ? '0' : '1';
      pct.textContent = String(Math.round(p * 100)).padStart(2, '0') + '%';
      if (p > 0.98 && !done) { done = true; sound.blip(1800, 0.04); }
      if (p < 0.9) done = false;
    },
  });
}

// X16 · Plan de vuelo: la trayectoria se dibuja con el scroll, el cohete la sigue y cada fase se enciende al pasar
export function initFlight({ gsap, ScrollTrigger, motion }) {
  const section = $('#proceso');
  const stage = $('#flightStage');
  const rocket = $('#fpRocket');
  const wps = $$('.wp', stage);
  const readout = $('#fpPct');
  const wide = $('.fs-wide', stage);
  const tall = $('.fs-tall', stage);
  let svg = null;
  let path = null;
  let L = 0;
  let geo = null;
  let at = null;
  let p = motion ? 0 : 1;

  // Anotaciones del plano (solo en la versión ancha)
  const grid = $('.fp-grid', wide);
  const notes = $('.fp-notes', wide);
  const wpath = $('.fp-path', wide);
  const wl = wpath.getTotalLength();
  wps.forEach((wp, i) => {
    const pt = wpath.getPointAtLength(wl * Number(wp.dataset.at));
    svgEl('line', { x1: pt.x, y1: pt.y + 12, x2: pt.x, y2: 506, 'stroke-dasharray': '3 5' }, grid);
    const t = svgEl('text', { x: pt.x + 6, y: 502 }, notes);
    t.textContent = S.flight.phase + (i + 1);
  });
  [[S.flight.notes[0], 60, 500], [S.flight.notes[1], 1080, 40]].forEach(([s, x, y]) => {
    const t = svgEl('text', { x, y }, notes);
    t.textContent = s.toUpperCase();
  });
  svgEl('line', { x1: 40, y1: 506, x2: 1160, y2: 506 }, notes);

  // La trayectoria de cada versión (ancha y alta) se mide una sola vez: no depende del tamaño de la pantalla
  const paths = new Map();
  const layout = () => {
    const isTall = getComputedStyle(tall).display !== 'none';
    svg = isTall ? tall : wide;
    if (!paths.has(svg)) {
      const pa = $('.fp-path', svg);
      const len = pa.getTotalLength();
      pa.style.strokeDasharray = `${len} ${len}`;
      paths.set(svg, { pa, len, at: pathSampler(pa, 600) });
    }
    ({ pa: path, len: L, at } = paths.get(svg));
    const vb = svg.viewBox.baseVal;
    const sw = stage.clientWidth;
    const sh = stage.clientHeight;
    const sc = Math.min(sw / vb.width, sh / vb.height);
    geo = { sc, ox: (sw - vb.width * sc) / 2, oy: (sh - vb.height * sc) / 2, isTall, vb };
    const toPx = (pt) => [geo.ox + pt.x * sc, geo.oy + pt.y * sc];
    wps.forEach((wp) => {
      const pt = path.getPointAtLength(L * Number(wp.dataset.at));
      const [x, y] = toPx(pt);
      const cw = wp.offsetWidth;
      const ch = wp.offsetHeight;
      let left, top;
      if (isTall) {
        left = pt.x < vb.width / 2 ? x + 26 : x - 26 - cw;
        top = y - ch / 2;
      } else {
        left = x - cw / 2;
        top = pt.y > vb.height * 0.5 ? y - ch - 30 : y + 30;
      }
      left = clamp(left, 0, sw - cw);
      top = clamp(top, -10, sh - ch + 10);
      wp.style.setProperty('--x', left.toFixed(1) + 'px');
      wp.style.setProperty('--y', top.toFixed(1) + 'px');
      wp.style.setProperty('--tx', '0px');
      wp.style.setProperty('--ty', '0px');
    });
    render();
  };

  let lastOn = -1;
  const render = () => {
    if (!path) return;
    path.style.strokeDashoffset = String(L * (1 - p));
    const a = at(p);
    const b = at(p + 0.004);
    const c = at(p - 0.004);
    const ang = (Math.atan2(b[1] - c[1], b[0] - c[0]) * 180) / Math.PI + 90;
    const x = geo.ox + a[0] * geo.sc;
    const y = geo.oy + a[1] * geo.sc;
    rocket.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${ang.toFixed(1)}deg)`;
    readout.textContent = Math.round(p * 100) + '%';
    let on = -1;
    wps.forEach((wp, i) => {
      const hit = p >= Number(wp.dataset.at) - 0.03;
      wp.classList.toggle('on', hit);
      if (hit) on = i;
    });
    if (on > lastOn && motion) sound.blip(600 + on * 200, 0.04);
    lastOn = on;
  };

  layout();
  // Se recoloca solo si cambia el tamaño del plano: el evento resize de la ventana también salta en el móvil
  // cada vez que la barra de direcciones aparece o se esconde, y el plano (62svh como mucho) no cambia
  onResize(stage, () => layout(), { changes: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  if (!motion) return;
  const mobile = () => getComputedStyle(tall).display !== 'none';
  const mm = gsap.matchMedia();
  mm.add('(min-width: 761px)', () => {
      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: () => '+=' + window.innerHeight * 1.6,
        pin: $('.flight-pin', section),
        scrub: 0.6,
        onUpdate: (s) => { p = s.progress; render(); },
        onRefresh: layout,
      });
  });
  mm.add('(max-width: 760px)', () => {
      ScrollTrigger.create({
        trigger: stage,
        start: 'top 70%',
        end: 'bottom 70%',
        scrub: 0.6,
        onUpdate: (s) => { p = s.progress; render(); },
        onRefresh: layout,
      });
  });
  if (mobile()) layout();
}
