import { $, $$, svgEl } from './util.js';
import { sound } from './sound.js';
import { S } from './i18n.js';

const M = S.mission;
const COLOR = { web: '#38bdf8', auto: '#22d3ee', mktg: '#a78bfa', intl: '#2dd4bf' };
const SERVICE = Object.fromEntries(Object.keys(COLOR).map((k) => [k, { name: M.service[k][0], goal: M.service[k][1], color: COLOR[k] }]));
// Por dónde empezaríamos según el tipo de negocio (orientativo)
const ORDER = {
  comercio: ['COM', ['web', 'mktg', 'auto', 'intl']],
  hosteleria: ['HOS', ['mktg', 'web', 'auto', 'intl']],
  distribucion: ['DIS', ['auto', 'intl', 'web', 'mktg']],
  servicios: ['SER', ['web', 'mktg', 'auto', 'intl']],
  industria: ['IND', ['auto', 'intl', 'web', 'mktg']],
  otro: ['OTR', ['web', 'auto', 'mktg', 'intl']],
};
const TYPES = Object.fromEntries(Object.entries(ORDER).map(([k, [code, order]]) => [k, { code, order, label: M.types[k][0], me: M.types[k][1] }]));
const WHEN = ['A', 'M', 'E'].map((k, i) => ({ k, text: M.when[i][0], msg: M.when[i][1] }));

// X19 · Configura tu misión: tres preguntas que montan un parche de misión, dicen por dónde empezar y rellenan el formulario
export function initMission({ gsap, motion, go }) {
  const form = $('#cfgForm');
  const when = $('#cfgWhen');
  const ringText = $('#cfgRingText');
  const orbits = $('#cfgOrbits');
  const code = $('#cfgCode');
  const start = $('#cfgStart');
  const then = $('#cfgThen');
  const patch = $('.cfg-patch');
  const send = $('#cfgSend');
  let snapshot = null;

  const read = () => {
    const type = (form.querySelector('input[name="tipo"]:checked') || {}).value || 'otro';
    const goals = $$('input[name="meta"]:checked', form).map((i) => i.value);
    const w = Number(when.value) || 0;
    return { type, goals, w };
  };

  const update = (user) => {
    const { type, goals, w } = read();
    const T = TYPES[type];
    const ordered = T.order.filter((g) => goals.includes(g));
    when.setAttribute('aria-valuetext', WHEN[w].text);
    when.style.setProperty('--fill', w * 50 + '%');
    ringText.textContent = M.ring(T.label);
    code.textContent = M.code(`IX-${T.code}-${goals.length}${WHEN[w].k}`);
    if (ordered.length) {
      start.textContent = SERVICE[ordered[0]].name;
      then.textContent = ordered.length > 1 ? M.then(ordered.slice(1).map((g) => SERVICE[g].name)) : M.thenOne;
    } else {
      start.textContent = M.startNone;
      then.textContent = M.thenNone;
    }
    // Órbitas del parche: una por objetivo marcado, cada una en su propia capa para girar sin repintar
    orbits.innerHTML = '';
    ordered.forEach((g, i) => {
      const r = 40 + i * 13;
      const grp = document.createElement('div');
      grp.style.setProperty('--t', 9 + i * 4 + 's');
      grp.style.setProperty('--c', SERVICE[g].color);
      orbits.appendChild(grp);
      const svg = svgEl('svg', { viewBox: '0 0 220 220' }, grp);
      svgEl('circle', { cx: 110, cy: 110, r, fill: 'none', stroke: 'rgba(255,255,255,0.14)' }, svg);
      const a = i * 1.9;
      svgEl('circle', { cx: 110 + Math.cos(a) * r, cy: 110 + Math.sin(a) * r, r: 4.5, class: 'pl' }, svg).style.fill = SERVICE[g].color;
    });
    snapshot = { T, ordered, w };
    if (user && motion) {
      gsap.fromTo(patch, { scale: 0.92, rotate: -4 }, { scale: 1, rotate: 0, duration: 0.6, ease: 'back.out(2.5)', transformOrigin: '50% 50%' });
      sound.blip(900 + ordered.length * 120, 0.035);
    }
  };

  form.addEventListener('change', () => update(true));
  when.addEventListener('input', () => update(true));
  update(false);

  // Lleva lo elegido al formulario de contacto
  send.addEventListener('click', (e) => {
    e.preventDefault();
    const { T, ordered, w } = snapshot;
    const sel = $('#fServicio');
    sel.value = ordered.length === 1 ? ordered[0] : ordered.length ? 'varios' : '';
    const goals = ordered.map((g) => SERVICE[g].goal);
    $('#fReto').value = M.message(T.me, goals, WHEN[w].msg);
    ['#fServicio', '#fReto'].forEach((s) => $(s).dispatchEvent(new Event('input', { bubbles: true })));
    go('#contacto');
    setTimeout(() => $('#fNombre').focus({ preventScroll: true }), motion ? 1400 : 50);
    sound.whoosh();
  });
}
