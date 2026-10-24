import { $, $$ } from './util.js';
import { sound } from './sound.js';
import { LANG, S } from './i18n.js';

const C = S.contact;
const RULES = {
  fNombre: (v) => v.trim().length >= 2,
  fEmail: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
  fServicio: (v) => !!v,
  fReto: (v) => v.trim().length >= 10,
};
// El servicio llega al email con su nombre en español, como en la web anterior
const SERVICE_ES = { web: 'Web & Ecommerce', auto: 'Automatización de procesos', mktg: 'Marketing digital', intl: 'Escalado e internacionalización', varios: 'Varios / No sé aún' };

// Envío real con Web3Forms: la misma clave, el mismo asunto y los mismos campos que la web anterior
// (name, company, email, service, message), más el idioma de la página
async function send(form) {
  const fd = new FormData(form);
  if (fd.get('botcheck')) return true; // casilla trampa marcada: es un robot, se descarta sin avisar
  const name = String(fd.get('name') || '').trim();
  const service = SERVICE_ES[fd.get('service')] || '';
  fd.set('subject', `${C.subject} ${name} — ${service || 'Consulta'}`);
  fd.set('service', service);
  fd.set('language', LANG.toUpperCase());
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 15000) : 0;
  try {
    const r = await fetch(form.action, { method: 'POST', headers: { Accept: 'application/json' }, body: fd, signal: ctrl ? ctrl.signal : undefined });
    const j = await r.json().catch(() => ({}));
    return r.ok && j.success === true;
  } catch (e) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// X22 · Lista de comprobación previa y combustible · X23 · Mantén pulsado para lanzar (y se envía de verdad)
export function initContact({ gsap, motion, state }) {
  const form = $('#launchForm');
  const ok = $('#launchOk');
  const btn = $('#holdBtn');
  const txt = $('#holdTxt');
  const note = $('#lfNote');
  const items = $$('#pfList li');
  const fuel = $('#fuelBar');
  const fuelPct = $('#fuelPct');
  const smoke = $('#smoke');
  const LABEL = motion ? C.hold : C.plain;
  txt.textContent = LABEL;
  let launching = false;
  const setNote = (text, err) => {
    note.textContent = text;
    note.classList.toggle('err', !!err);
  };

  const check = () => {
    let n = 0;
    items.forEach((li) => {
      const el = document.getElementById(li.dataset.for);
      const good = RULES[li.dataset.for](el.value);
      li.classList.toggle('ok', good);
      if (good) {
        li.classList.remove('bad');
        el.closest('.fld').classList.remove('bad');
      }
      n += good ? 1 : 0;
    });
    fuel.style.transform = `scaleX(${n / items.length})`;
    fuelPct.textContent = Math.round((n / items.length) * 100) + '%';
    return n === items.length;
  };
  form.addEventListener('input', check);
  form.addEventListener('change', check);
  check();

  const abort = () => {
    const bad = items.filter((li) => !li.classList.contains('ok'));
    bad.forEach((li) => {
      li.classList.add('bad');
      document.getElementById(li.dataset.for).closest('.fld').classList.add('bad');
    });
    setNote(C.abort(bad.map((li) => C.names[li.dataset.for])), true);
    sound.beep(220, 0.18, 0.1);
    if (motion) gsap.fromTo(btn, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
    const first = bad[0] && document.getElementById(bad[0].dataset.for);
    if (first) first.focus();
  };

  const success = () => {
    form.hidden = true;
    ok.hidden = false;
    ok.focus({ preventScroll: true });
    if (state.onLaunch) state.onLaunch();
    sound.chord();
    if (motion) gsap.from(ok.children, { y: 18, opacity: 0, duration: 0.8, ease: 'expo.out', stagger: 0.07 });
  };

  // Humo y cohete que sale del botón
  const fly = () => {
    const ico = $('.hold-ico', btn);
    const r = ico.getBoundingClientRect();
    const rocket = ico.cloneNode(true);
    Object.assign(rocket.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', zIndex: 200, color: '#7dd3fc', pointerEvents: 'none' });
    document.body.appendChild(rocket);
    const ctx = smoke.getContext('2d');
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const sr = smoke.getBoundingClientRect();
    smoke.width = Math.round(sr.width * dpr);
    smoke.height = Math.round(sr.height * dpr);
    const parts = [];
    const pos = { y: 0, s: 1 };
    gsap.to(pos, { y: -window.innerHeight * 0.9, s: 1.8, duration: 1.5, ease: 'power2.in' });
    const t0 = performance.now();
    const step = (now) => {
      const el = (now - t0) / 1000;
      rocket.style.transform = `translate3d(0, ${pos.y.toFixed(1)}px, 0) scale(${pos.s.toFixed(3)})`;
      const cx = r.left + r.width / 2 - sr.left;
      const cy = r.top + r.height - sr.top + pos.y;
      if (el < 1.4) {
        for (let k = 0; k < 5; k++) parts.push({ x: cx + (Math.random() - 0.5) * 10, y: cy, vx: (Math.random() - 0.5) * 2.4, vy: 1 + Math.random() * 2.5, r: 4 + Math.random() * 6, life: 1 });
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, sr.width, sr.height);
      for (let i = parts.length - 1; i >= 0; i--) {
        const q = parts[i];
        q.x += q.vx;
        q.y += q.vy;
        q.vx *= 0.98;
        q.vy *= 0.96;
        q.r += 0.7;
        q.life -= 0.018;
        if (q.life <= 0) { parts.splice(i, 1); continue; }
        ctx.fillStyle = `rgba(${q.life > 0.8 ? '253,224,171' : '170,190,215'},${(q.life * 0.35).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (el < 3 && (parts.length || el < 1.5)) requestAnimationFrame(step);
      else { ctx.clearRect(0, 0, sr.width, sr.height); rocket.remove(); }
    };
    requestAnimationFrame(step);
  };

  // Si no se puede enviar, el formulario conserva lo escrito y ofrece el email y WhatsApp
  const fail = () => {
    launching = false;
    note.innerHTML = C.fail;
    note.classList.add('err');
    txt.textContent = LABEL;
    if (motion) gsap.to(btn, { '--hold': 0, duration: 0.3 });
    else btn.style.setProperty('--hold', '0');
    sound.beep(220, 0.18, 0.1);
  };

  // El cohete solo despega cuando el mensaje ha llegado
  const launch = async () => {
    if (!check()) { abort(); return; }
    launching = true;
    setNote('');
    txt.textContent = C.sending;
    btn.classList.add('is-sending');
    btn.setAttribute('aria-busy', 'true');
    const sent = await send(form);
    btn.classList.remove('is-sending');
    btn.removeAttribute('aria-busy');
    if (!sent) { fail(); return; }
    if (!motion) { success(); return; }
    txt.textContent = C.liftoff;
    sound.launch();
    fly();
    gsap.to('.launch', { y: 6, duration: 0.06, repeat: 9, yoyo: true, ease: 'none', clearProps: 'transform' });
    setTimeout(success, 1300);
  };

  // Presión mantenida (ratón, dedo o teclado)
  let tw = null;
  let holding = false;
  let doneAt = -1e9;
  const start = () => {
    if (launching || holding) return;
    holding = true;
    btn.classList.add('is-holding');
    let last = 4;
    tw = gsap.to(btn, {
      '--hold': 1,
      duration: 1.1,
      ease: 'none',
      onUpdate() {
        const left = Math.ceil((1 - this.progress()) * 3);
        if (left !== last && left > 0) { last = left; txt.textContent = C.countdown(left); sound.beep(520 + (3 - left) * 140, 0.08, 0.08); }
      },
      onComplete: () => {
        holding = false;
        doneAt = performance.now();
        btn.classList.remove('is-holding');
        launch();
        if (!launching) { gsap.to(btn, { '--hold': 0, duration: 0.3 }); txt.textContent = LABEL; }
      },
    });
  };
  const cancel = () => {
    if (!holding) return;
    holding = false;
    if (tw) tw.kill();
    btn.classList.remove('is-holding');
    gsap.to(btn, { '--hold': 0, duration: 0.3, ease: 'power2.out' });
    txt.textContent = LABEL;
  };
  const hint = () => setNote(C.hint);
  if (motion) {
    btn.addEventListener('pointerdown', (e) => { if (e.button === 0) start(); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, cancel));
    btn.addEventListener('keydown', (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      if (!e.repeat) start();
    });
    btn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') cancel(); });
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (launching) return;
    if (motion) { if (!holding && performance.now() - doneAt > 900) hint(); return; }
    launch();
  });

  $('#launchAgain').addEventListener('click', () => {
    form.reset();
    setNote('');
    launching = false;
    ok.hidden = true;
    form.hidden = false;
    btn.style.setProperty('--hold', '0');
    txt.textContent = LABEL;
    items.forEach((li) => li.classList.remove('bad'));
    $$('.fld', form).forEach((f) => f.classList.remove('bad'));
    check();
    $('#fNombre').focus();
  });
}
