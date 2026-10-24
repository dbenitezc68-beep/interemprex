export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const map = (v, a, b, c, d) => c + ((v - a) * (d - c)) / (b - a);
export const mapc = (v, a, b, c, d) => clamp(map(v, a, b, c, d), Math.min(c, d), Math.max(c, d));
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export const store = {
  get(k) {
    try { return window.localStorage.getItem(k); } catch (e) { return null; }
  },
  set(k, v) {
    try { window.localStorage.setItem(k, v); } catch (e) { /* almacenamiento no disponible */ }
  },
};

export function onVisible(el, cb, rootMargin = '120px') {
  if (!('IntersectionObserver' in window)) { cb(true); return null; }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => cb(e.isIntersecting, e)), { rootMargin });
  io.observe(el);
  return io;
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const toLinear = (hex) => hexToRgb(hex).map((c) => Math.pow(c / 255, 2.2));

export function splitChars(el) {
  const text = el.textContent;
  el.setAttribute('aria-hidden', 'true');
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

export function splitWords(el, skipSelector) {
  const words = [];
  const walk = (node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === 3) {
        const parts = child.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        parts.forEach((p) => {
          if (!p) return;
          if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
          const s = document.createElement('span');
          s.className = 'mw';
          s.textContent = p;
          frag.appendChild(s);
          words.push(s);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && !(skipSelector && child.matches(skipSelector))) {
        walk(child);
      } else if (child.nodeType === 1) {
        child.classList.add('mw');
        words.push(child);
      }
    });
  };
  walk(el);
  return words;
}

export function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return { h, m, s: r, hh: String(h).padStart(2, '0'), mm: String(m).padStart(2, '0'), ss: String(r).padStart(2, '0') };
}

export const ns = 'http://www.w3.org/2000/svg';
export function svgEl(tag, attrs = {}, parent) {
  const el = document.createElementNS(ns, tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  if (parent) parent.appendChild(el);
  return el;
}

export function safe(name, fn) {
  try { return fn(); } catch (err) {
    console.warn('[INTEREMPREX] No se pudo iniciar ' + name, err);
    return null;
  }
}
