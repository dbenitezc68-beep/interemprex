import { $, clamp, lerp, splitWords, onVisible, ON_SCREEN } from './util.js';
import { sound } from './sound.js';
import { S } from './i18n.js';

// X06 · Manifiesto que se enciende palabra a palabra, con píldoras vivas
export function initManifesto({ gsap, motion }) {
  const section = $('#manifiesto');
  const text = $('#manifestoText');
  const words = splitWords(text, '.pill');
  if (!motion) return;
  const tl = gsap.timeline({
    scrollTrigger: { trigger: section, start: 'top top', end: () => '+=' + window.innerHeight * 1.5, pin: $('.pin-wrap', section), scrub: 0.6 },
  });
  tl.to(words, { opacity: 1, stagger: 0.1, duration: 0.3, ease: 'none' }, 0);
  words.forEach((w, i) => {
    if (w.classList.contains('pill')) tl.fromTo(w, { scale: 0.2, rotate: -12 }, { scale: 1, rotate: 0, duration: 0.35, ease: 'back.out(3)' }, i * 0.1);
  });
  tl.to({}, { duration: 0.5 });
}

// X17 · Informe contra sistema: comparador arrastrable con un panel que trabaja solo
const ROWS = S.compare.rows;
export function initCompare({ gsap, ScrollTrigger, motion, fine }) {
  const cmp = $('#cmp');
  const range = $('#cmpRange');
  const rowsEl = $('#dashRows');
  const line = $('#dashLine');
  const setPos = (v, user) => {
    const x = clamp(v, 0, 100);
    cmp.style.setProperty('--pos', x + '%');
    range.value = String(Math.round(x));
    range.setAttribute('aria-valuetext', x < 20 ? S.compare.mostlyReport : x > 80 ? S.compare.mostlySystem : S.compare.half);
    if (user) userMoved = true;
  };
  let userMoved = false;
  let dragging = false;
  const fromEvent = (e) => {
    const r = cmp.getBoundingClientRect();
    setPos(((e.clientX - r.left) / r.width) * 100, true);
  };
  cmp.addEventListener('pointerdown', (e) => {
    if (e.target === range) return;
    dragging = true;
    if (e.pointerType === 'mouse') cmp.setPointerCapture(e.pointerId);
    fromEvent(e);
  });
  cmp.addEventListener('pointermove', (e) => { if (dragging) fromEvent(e); });
  const stop = () => { dragging = false; };
  cmp.addEventListener('pointerup', stop);
  cmp.addEventListener('pointercancel', stop);
  range.addEventListener('input', () => setPos(Number(range.value), true));

  // Panel del sistema: filas que avanzan de estado y una curva que sube
  let id = 1040;
  const live = [];
  const addRow = () => {
    const [name, steps] = ROWS[id % ROWS.length];
    const li = document.createElement('li');
    li.innerHTML = `<span class="id">${S.compare.id}${id}</span><span>${name}</span><span class="st w">${steps[0]}</span>`;
    rowsEl.prepend(li);
    live.unshift({ li, steps, k: 0 });
    id++;
    while (live.length > 5) live.pop().li.remove();
    if (!motion) return;
    // En pantallas táctiles la entrada la hace el navegador (no ocupa el hilo principal y deja dormir el reloj de
    // animación entre fila y fila); con ratón, la de siempre
    if (!fine && li.animate) li.animate([{ transform: 'translate3d(0, -14px, 0)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 500, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    else gsap.from(li, { y: -14, opacity: 0, duration: 0.5, ease: 'expo.out' });
  };
  const advance = () => {
    live.forEach((r) => {
      if (r.k < r.steps.length - 1 && Math.random() < 0.6) {
        r.k++;
        const st = $('.st', r.li);
        st.textContent = r.steps[r.k];
        st.classList.toggle('w', r.k < r.steps.length - 1);
      }
    });
  };
  const pts = Array.from({ length: 24 }, (_, i) => 52 - i * 1.2 + Math.sin(i * 1.7) * 4);
  const drawLine = () => {
    line.setAttribute('d', pts.map((y, i) => `${i ? 'L' : 'M'}${((i / (pts.length - 1)) * 300).toFixed(1)} ${clamp(y, 6, 64).toFixed(1)}`).join(' '));
  };
  for (let i = 0; i < 4; i++) addRow();
  live.forEach((r) => { r.k = r.steps.length - 1; const st = $('.st', r.li); st.textContent = r.steps[r.k]; st.classList.remove('w'); });
  drawLine();
  if (!motion) return;
  let timer = 0;
  let n = 0;
  onVisible(cmp, (v) => {
    clearInterval(timer);
    if (!v) return;
    timer = setInterval(() => {
      n++;
      if (n % 2 === 0) addRow();
      advance();
      pts.shift();
      const last = pts[pts.length - 1];
      pts.push(clamp(last - 0.8 + (Math.random() - 0.45) * 7, 10, 60));
      drawLine();
    }, 900);
  }, ON_SCREEN);
  // Barrido de presentación la primera vez que se ve
  ScrollTrigger.create({
    trigger: cmp,
    start: 'top 70%',
    once: true,
    onEnter: () => {
      if (userMoved) return;
      const o = { v: 50 };
      gsap.timeline()
        .to(o, { v: 18, duration: 0.9, ease: 'power2.inOut', onUpdate: () => !userMoved && setPos(o.v) })
        .to(o, { v: 82, duration: 1.3, ease: 'power2.inOut', onUpdate: () => !userMoved && setPos(o.v) })
        .to(o, { v: 50, duration: 0.9, ease: 'power2.inOut', onUpdate: () => !userMoved && setPos(o.v) });
    },
  });
}

// X24 · Logotipo que responde: cada letra gana peso bajo el puntero, y una ola recorre la palabra al llegar al pie
// (y al tocarla en pantallas táctiles). Solo se trabaja mientras alguna letra está cambiando: cambiar el peso de
// letras tan grandes obliga a redibujarlas, así que en reposo no se toca nada.
export function initFooter({ gsap, motion, fine }) {
  const W = window;
  const foot = $('#base');
  const word = $('#footWord');
  const letters = [];
  ['INTER', 'EMPREX'].forEach((part, k) => {
    for (const ch of part) {
      const s = document.createElement('span');
      s.className = k ? 'ch e' : 'ch';
      s.textContent = ch;
      s.setAttribute('aria-hidden', 'true');
      word.appendChild(s);
      letters.push(s);
    }
  });
  if (!motion) {
    letters.forEach((l) => l.style.setProperty('--w', '600'));
    $('.foot-top', foot).addEventListener('click', () => sound.whoosh());
    return;
  }
  const REST = 500;
  const weights = letters.map(() => REST);
  const shown = letters.map(() => REST);
  let centers = null;
  let mx = -9999, my = -9999;
  let wave = -1;
  let running = false;
  // Centros de las letras en coordenadas de página: se miden al entrar el puntero, no en cada fotograma
  const measure = () => {
    centers = letters.map((l) => {
      const r = l.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2 + W.scrollY];
    });
  };
  const target = (i, time) => {
    if (mx > -9000 && centers) {
      const [cx, cy] = centers[i];
      const d = Math.hypot(cx - mx, (cy - W.scrollY - my) * 0.6);
      return 300 + 400 * Math.max(0, 1 - d / 260);
    }
    if (wave >= 0) {
      const k = (time - wave - i * 0.09) / 0.9;
      if (k > 0 && k < 1) return REST + 200 * Math.sin(Math.PI * k);
    }
    return REST;
  };
  const tick = (time, dt) => {
    if (wave >= 0 && time - wave > 0.9 + letters.length * 0.09) wave = -1;
    let busy = wave >= 0;
    // Suavizado que no depende de los fotogramas por segundo: se asienta igual de rápido en un móvil lento
    const f = 1 - Math.pow(0.86, Math.min(dt || 16.7, 100) / 16.7);
    letters.forEach((l, i) => {
      const t = target(i, time);
      const w = lerp(weights[i], t, f);
      weights[i] = Math.abs(w - t) < 0.5 ? t : w;
      if (weights[i] !== t) busy = true;
      const r = Math.round(weights[i]);
      if (r !== shown[i]) { shown[i] = r; l.style.setProperty('--w', r); }
    });
    if (!busy) { gsap.ticker.remove(tick); running = false; }
  };
  const run = () => { if (!running) { running = true; gsap.ticker.add(tick); } };
  const playWave = () => { wave = gsap.ticker.time; run(); };
  onVisible(foot, (v) => { if (v) playWave(); }, '0px');
  if (fine) {
    foot.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') measure(); });
    foot.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (!centers) measure();
      mx = e.clientX;
      my = e.clientY;
      run();
    }, { passive: true });
    foot.addEventListener('pointerleave', () => { mx = -9999; run(); });
    W.addEventListener('resize', () => { centers = null; });
  }
  word.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') playWave(); });
  gsap.from('.foot-grid > *', { y: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: foot, start: 'top 85%' } });

  $('.foot-top', foot).addEventListener('click', () => sound.whoosh());
}
