import { $ } from './util.js';
import { sound } from './sound.js';
import { LANG, S } from './i18n.js';

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// X21 · Buscador (Ctrl o ⌘ + K): saltar a cualquier sección o lanzar una acción desde el teclado
export function initPalette({ go, note, lock, actions }) {
  const box = $('#cmdk');
  const input = $('#cmdkInput');
  const list = $('#cmdkList');
  const btn = $('#btnCmd');
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  $('#cmdKbd').textContent = isMac ? '⌘ K' : 'Ctrl K';

  const P = S.palette;
  const ITEMS = [
    ...P.nav.map(([label, target, ic, kw]) => ({ g: P.go, label, ic, kw, run: () => go(target) })),
    { g: P.actions, label: P.wa[0], ic: 'WA', kw: P.wa[1], run: () => window.open('https://wa.me/34656718916', '_blank', 'noopener') },
    {
      g: P.actions, label: P.mail[0], ic: '@', kw: P.mail[1], run: async () => {
        try { await navigator.clipboard.writeText('Interemprex@gmail.com'); note(P.copied); } catch (e) { note('Interemprex@gmail.com'); }
      },
    },
    { g: P.actions, label: P.call[0], ic: 'TEL', kw: P.call[1], run: () => { window.location.href = 'tel:+34656718916'; } },
    { g: P.actions, label: P.legal[0], ic: '§', kw: P.legal[1], run: actions.legal },
    { g: P.actions, label: P.lang[0], ic: LANG === 'en' ? 'ES' : 'EN', kw: P.lang[1], run: actions.lang },
    { g: P.actions, label: P.sound[0], ic: '♪', kw: P.sound[1], run: actions.sound },
    { g: P.actions, label: P.motion[0], ic: '‖', kw: P.motion[1], run: actions.motion },
    { g: P.actions, label: P.replay[0], ic: 'T−', kw: P.replay[1], run: actions.replay },
  ];

  let shown = [];
  let sel = 0;
  let back = null;
  const render = () => {
    const q = norm(input.value.trim());
    const toks = q.split(/\s+/).filter(Boolean);
    shown = ITEMS.filter((it) => {
      const hay = norm(it.label + ' ' + it.kw + ' ' + it.ic);
      return toks.every((t) => hay.includes(t));
    });
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    list.innerHTML = '';
    if (!shown.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = P.empty;
      list.appendChild(li);
      input.removeAttribute('aria-activedescendant');
      return;
    }
    let g = '';
    shown.forEach((it, i) => {
      if (it.g !== g) {
        g = it.g;
        const h = document.createElement('li');
        h.className = 'grp';
        h.setAttribute('role', 'presentation');
        h.textContent = g;
        list.appendChild(h);
      }
      const li = document.createElement('li');
      li.id = 'cmdk-' + i;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === sel));
      li.innerHTML = `<span class="ic" aria-hidden="true">${it.ic}</span><span>${it.label}</span><span class="k">${it.g === P.go ? P.goK : P.doK}</span>`;
      li.addEventListener('pointermove', () => { if (sel !== i) { sel = i; mark(); } });
      li.addEventListener('click', () => runSel(i));
      list.appendChild(li);
    });
    mark();
  };
  const mark = () => {
    Array.from(list.querySelectorAll('[role="option"]')).forEach((li) => {
      const on = li.id === 'cmdk-' + sel;
      li.setAttribute('aria-selected', String(on));
      if (on) {
        input.setAttribute('aria-activedescendant', li.id);
        li.scrollIntoView({ block: 'nearest' });
      }
    });
  };
  const open = () => {
    if (!box.hidden) return;
    back = document.activeElement;
    box.hidden = false;
    input.value = '';
    sel = 0;
    render();
    lock.stop();
    input.focus();
    sound.blip(1000, 0.03);
  };
  const close = (restore = true) => {
    if (box.hidden) return;
    box.hidden = true;
    lock.start();
    if (restore && back && back.focus) back.focus({ preventScroll: true });
  };
  const runSel = (i) => {
    const it = shown[i];
    if (!it) return;
    close(false);
    it.run();
  };

  input.addEventListener('input', () => { sel = 0; render(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, shown.length); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + shown.length) % Math.max(1, shown.length); mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); runSel(sel); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') { e.preventDefault(); }
  });
  box.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) close(); });
  btn.addEventListener('click', open);
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (box.hidden) open(); else close();
    }
  });
  list.setAttribute('data-lenis-prevent', '');
  return { open, close, get isOpen() { return !box.hidden; } };
}
