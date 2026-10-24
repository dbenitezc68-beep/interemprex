import { $, $$ } from './util.js';

// Textos legales: ventana nativa (<dialog>) con cuatro pestañas. Se abre desde el pie, desde el aviso del
// formulario, desde el buscador o con un enlace directo (#privacidad, #cookies, #aviso-legal, #condiciones).
const HASH = { privacidad: 'privacy', privacy: 'privacy', cookies: 'cookies', 'aviso-legal': 'legal', 'legal-notice': 'legal', condiciones: 'terms', terms: 'terms' };

export function initLegal({ lock }) {
  const dlg = $('#legal');
  const body = $('#legalBody');
  const tabs = $$('[role="tab"]', dlg);
  const native = typeof dlg.showModal === 'function';
  let back = null;

  const select = (key, focus) => {
    tabs.forEach((t) => {
      const on = t.dataset.legalTab === key;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      if (on && focus) t.focus();
    });
    body.scrollTop = 0;
  };
  let shown = false;
  // Se ejecuta al momento al cerrar (el evento «close» del navegador llega más tarde y no debe repetirlo)
  const closed = () => {
    if (!shown) return;
    shown = false;
    document.documentElement.classList.remove('legal-open');
    lock.start();
    if (back && back.focus) back.focus({ preventScroll: true });
    back = null;
  };
  const open = (key = 'privacy', from) => {
    if (!HASH[key] && !tabs.some((t) => t.dataset.legalTab === key)) key = 'privacy';
    select(HASH[key] || key);
    if (!dlg.open) {
      back = from || document.activeElement;
      if (native) dlg.showModal();
      else dlg.setAttribute('open', '');
      document.documentElement.classList.add('legal-open');
      lock.stop();
      shown = true;
    }
    const cur = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
    if (cur) cur.focus({ preventScroll: true });
  };
  const close = () => {
    if (dlg.open) {
      if (native) dlg.close();
      else dlg.removeAttribute('open');
    }
    closed();
  };

  dlg.addEventListener('close', closed);
  // Escape: se cierra aquí mismo para devolver el desplazamiento y el foco sin esperar al evento «close»
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  $('#legalClose').addEventListener('click', close);
  // Un clic fuera de la caja (en el fondo) también cierra
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t.dataset.legalTab));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      select(tabs[(i + d + tabs.length) % tabs.length].dataset.legalTab, true);
    });
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.legal-link');
    if (!b) return;
    e.preventDefault();
    open(b.dataset.legal, b);
  });
  if (!native) document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && dlg.open) close(); });

  const fromHash = () => HASH[decodeURIComponent(location.hash.slice(1)).toLowerCase()] || null;
  return { open, close, fromHash, get isOpen() { return dlg.open; } };
}
