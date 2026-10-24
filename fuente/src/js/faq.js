import { $, onVisible } from './util.js';
import { sound } from './sound.js';
import { S } from './i18n.js';

// Respuestas sacadas de las condiciones de servicio y la política de interemprex.com (textos en i18n.js)
const F = S.faq;
const QA = F.qa;
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!.,;:]/g, ' ');

// X20 · Consola de dudas: preguntas con respuesta tecleada y búsqueda por palabras (sin inteligencia artificial)
export function initFaq({ motion, go }) {
  const log = $('#termLog');
  const form = $('#termForm');
  const input = $('#termIn');
  const chips = $('#termChips');
  let typing = null;

  const line = (cls, text) => {
    const p = document.createElement('p');
    p.className = cls;
    if (text != null) p.textContent = text;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
    return p;
  };
  const finish = () => {
    if (!typing) return;
    clearTimeout(typing.t);
    typing.el.innerHTML = typing.html;
    typing = null;
    log.scrollTop = log.scrollHeight;
  };
  const answer = (text, html) => {
    finish();
    const el = line('a');
    const full = html || text;
    if (!motion) { el.innerHTML = full; log.scrollTop = log.scrollHeight; return; }
    const caret = '<span class="caret" aria-hidden="true"></span>';
    let i = 0;
    typing = { el, html: full, t: 0 };
    const step = () => {
      i = Math.min(text.length, i + 2);
      el.innerHTML = text.slice(0, i).replace(/&/g, '&amp;').replace(/</g, '&lt;') + caret;
      log.scrollTop = log.scrollHeight;
      if (i % 6 === 0) sound.key();
      if (i < text.length) typing.t = setTimeout(step, 22);
      else { el.innerHTML = full; typing = null; }
    };
    step();
  };
  const ask = (raw) => {
    const q = raw.trim();
    if (!q) return;
    line('q', q);
    const n = norm(q);
    if (/^(ayuda|help|\?)$/.test(n.trim())) { answer(F.help(QA.map((x) => x.q.replace(/[¿?]/g, '')).join(' · '))); return; }
    if (/^(limpiar|clear|cls)$/.test(n.trim())) { finish(); log.innerHTML = ''; line('sys', F.cleared); return; }
    if (F.contact.test(n.trim())) { answer(F.toContact); go('#contacto'); return; }
    if (/whatsapp|wasap|telefono|llamar|\bphone\b|\bcall\b/.test(n)) {
      answer(F.phone, F.phoneHtml);
      return;
    }
    const words = n.split(/\s+/).filter(Boolean);
    let best = null;
    let score = 0;
    QA.forEach((x) => {
      const s = x.k.reduce((acc, k) => acc + (words.some((w) => w.startsWith(k) || k.startsWith(w) && w.length > 3) ? 1 : 0), 0);
      if (s > score) { score = s; best = x; }
    });
    if (best) answer(best.a);
    else answer(F.none, F.noneHtml);
  };

  QA.forEach((x) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = x.q;
    b.addEventListener('click', () => { line('q', x.q); answer(x.a); sound.tick(); });
    chips.appendChild(b);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    ask(input.value);
    input.value = '';
  });
  // Demostración automática: teclea una pregunta real si nadie ha tocado la consola
  let touched = false;
  const touch = () => { touched = true; };
  input.addEventListener('pointerdown', touch);
  input.addEventListener('keydown', touch);
  chips.addEventListener('click', touch);
  const demo = () => {
    const q = QA[0].q;
    let i = 0;
    const type = () => {
      if (touched) { if (input.value === q.slice(0, i)) input.value = ''; return; }
      input.value = q.slice(0, ++i);
      if (i % 3 === 0) sound.key();
      if (i < q.length) setTimeout(type, 55);
      else setTimeout(() => { if (!touched) { ask(q); input.value = ''; } }, 420);
    };
    type();
  };
  let greeted = false;
  const greet = () => {
    if (greeted) return;
    greeted = true;
    line('sys', F.ready);
    if (motion) setTimeout(() => { if (!touched) demo(); }, 1300);
  };
  if (motion) onVisible(log, (v) => { if (v) greet(); }); else greet();
}
