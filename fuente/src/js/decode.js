import { $$ } from './util.js';

// X04 · Titulares que se descifran: cada letra pasa por símbolos al azar hasta fijarse.
// El texto real queda para los lectores de pantalla; las letras animadas van ocultas a ellos.
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/<>*+=';

function prepare(el) {
  const text = el.textContent.trim();
  el.textContent = '';
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = text;
  const vis = document.createElement('span');
  vis.setAttribute('aria-hidden', 'true');
  const chars = [];
  text.split(/(\s+)/).forEach((part) => {
    if (!part) return;
    if (/^\s+$/.test(part)) { vis.appendChild(document.createTextNode(' ')); return; }
    const word = document.createElement('span');
    word.style.whiteSpace = 'nowrap';
    for (const ch of part) {
      const s = document.createElement('span');
      s.textContent = ch;
      s.dataset.ch = ch;
      word.appendChild(s);
      chars.push(s);
    }
    vis.appendChild(word);
  });
  el.append(sr, vis);
  return chars;
}

const glyph = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];

function run(chars) {
  // Fija el ancho de cada letra mientras dura el baile para que la línea no tiemble. Se mide en el texto normal y
  // sin redondear: con anchos redondeados, algunos titulares cambiaban de número de líneas durante el baile y movían
  // toda la página (en el móvil, sobre todo)
  chars.forEach((c) => { c.textContent = c.dataset.ch; });
  const widths = chars.map((c) => c.getBoundingClientRect().width);
  chars.forEach((c, i) => { c.style.display = 'inline-block'; c.style.width = widths[i] + 'px'; });
  const t0 = performance.now();
  const step = Math.max(9, Math.min(22, 900 / chars.length));
  const tick = (now) => {
    const el = now - t0;
    let done = true;
    chars.forEach((c, i) => {
      const at = 160 + i * step;
      if (el >= at) {
        if (c.textContent !== c.dataset.ch) c.textContent = c.dataset.ch;
        c.style.opacity = '';
      } else {
        done = false;
        if (el >= i * step * 0.5) {
          c.style.opacity = '1';
          if (Math.random() < 0.5 || c.textContent === c.dataset.ch) c.textContent = glyph();
        }
      }
    });
    if (done) {
      chars.forEach((c) => { c.style.width = ''; c.style.display = ''; });
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function initDecode({ ScrollTrigger, motion }) {
  if (!motion || !ScrollTrigger) return;
  $$('.decode').forEach((el) => {
    const chars = prepare(el);
    // Si el titular ya quedó atrás (recarga a mitad de página), se deja escrito
    if (el.getBoundingClientRect().bottom < 0) return;
    chars.forEach((c) => { c.style.opacity = '0'; });
    ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => run(chars) });
  });
}
