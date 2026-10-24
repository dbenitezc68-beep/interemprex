import { $, $$, store, safe } from './util.js';
import { sound } from './sound.js';
import { initStars } from './stars.js';
import { initDecode } from './decode.js';
import { initHero } from './hero.js';
import { initTelemetry } from './telemetry.js';
import { initManifesto, initCompare, initFooter } from './sections.js';
import { initChaos } from './chaos.js';
import { initServices } from './services.js';
import { initGlobe } from './globe.js';
import { initResults } from './results.js';
import { initScan, initFlight } from './flight.js';
import { initMission } from './mission.js';
import { initFaq } from './faq.js';
import { initContact } from './contact.js';
import { initPalette } from './palette.js';
import { initLegal } from './legal.js';
import { S } from './i18n.js';

// Sustituto mínimo si GSAP no llega a cargar: la página queda estática pero usable.
function gsapStub() {
  const tw = { to: () => tw, from: () => tw, fromTo: () => tw, set: () => tw, call: () => tw, add: () => tw, kill() {}, play() {}, pause() {}, progress: () => tw, then: (f) => f && f() };
  return { registerPlugin() {}, to: () => tw, from: () => tw, fromTo: () => tw, set: () => tw, timeline: () => tw, quickTo: () => () => {}, matchMedia: () => ({ add() {} }), ticker: { add() {}, remove() {}, lagSmoothing() {} } };
}

function boot() {
  const html = document.documentElement;
  const W = window;
  const libs = !!(W.gsap && W.ScrollTrigger);
  const gsap = libs ? W.gsap : gsapStub();
  const ScrollTrigger = libs ? W.ScrollTrigger : null;
  const params = new URLSearchParams(location.search);
  const pref = store.get('ix-motion');
  const sysReduced = W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reduced = params.has('reducido') || (pref ? pref === 'reduced' : sysReduced);
  const motion = libs && !reduced;
  html.classList.add(motion ? 'motion' : libs ? 'reduced' : 'static');
  // La cabecera del HTML enciende la precarga antes de pintar; sin animaciones se apaga aquí
  if (!motion) html.classList.remove('is-loading');
  const fine = W.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (fine) html.classList.add('fine');
  html.dataset.scene = 'space';
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (libs) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    // El reloj de GSAP se duerme antes cuando nada se anima (por defecto espera 120 fotogramas). Con Lenis
    // (ordenador) no cambia nada: Lenis lo mantiene en marcha.
    gsap.config({ autoSleep: 30 });
  }
  // ScrollTrigger deja un requestAnimationFrame en bucle que no para nunca (_rafBugFix, un apaño para que Firefox
  // repinte con regularidad). En pantallas táctiles obliga a preparar todos los fotogramas aunque la página esté
  // quieta, así que fuera de Firefox se corta; ScrollTrigger se sigue actualizando con cada scroll igual que antes.
  if (libs && !fine && !/firefox/i.test(navigator.userAgent)) {
    const raf = W.requestAnimationFrame;
    W.requestAnimationFrame = function (cb) { return cb && cb.name === '_rafBugFix' ? 0 : raf.call(W, cb); };
  }

  // Scroll suave sincronizado con ScrollTrigger, solo con ratón o panel táctil: es lo que suaviza la rueda.
  // En pantallas táctiles el scroll del dedo ya es nativo y suave, y Lenis solo añadiría escuchas que hacen
  // esperar al navegador antes de mover la página y un trabajo en cada fotograma aunque nada se mueva.
  let lenis = null;
  if (motion && fine && W.Lenis) {
    lenis = new W.Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 0.95, allowNestedScroll: true, respectReducedMotion: false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  // Posición y velocidad del scroll sin leer la maqueta en cada fotograma: con Lenis las da Lenis; sin él, el
  // evento scroll (velocidad en píxeles por fotograma de 60 Hz, a cero al parar)
  let sy = W.scrollY;
  let sv = 0;
  let sAt = 0;
  let sStop = 0;
  if (!lenis) {
    W.addEventListener('scroll', () => {
      const y = W.scrollY;
      const now = performance.now();
      const dt = now - sAt;
      sv = dt > 0 && dt < 100 ? ((y - sy) * 16.7) / dt : 0;
      sy = y;
      sAt = now;
      clearTimeout(sStop);
      sStop = setTimeout(() => { sv = 0; }, 150);
    }, { passive: true });
  }
  const getScroll = () => (lenis ? lenis.scroll : sy);
  const getVelocity = () => (lenis ? lenis.velocity : sv);
  // Bloqueo del scroll mientras hay algo abierto encima (cuenta atrás, menú, buscador, textos legales):
  // con Lenis se para Lenis; sin él, con CSS
  const lock = lenis || {
    stop: () => html.classList.add('is-locked'),
    start: () => html.classList.remove('is-locked'),
  };
  const state = {};
  const scrollTo = (target, opts = {}) => {
    if (target == null) return;
    if (lenis) {
      const y = typeof target === 'number' ? target : target.getBoundingClientRect().top + W.scrollY;
      const dist = Math.abs(y - W.scrollY);
      lenis.scrollTo(target, { duration: Math.min(2.6, 0.9 + dist / 9000), easing: (t) => 1 - Math.pow(1 - t, 4), ...opts });
    } else if (motion) {
      // Sin Lenis, el desplazamiento suave del propio navegador (lo mueve fuera del hilo principal)
      const y = typeof target === 'number' ? target : target.getBoundingClientRect().top + W.scrollY;
      W.scrollTo({ top: y, behavior: opts.immediate ? 'auto' : 'smooth' });
    } else if (typeof target === 'number') W.scrollTo(0, target);
    else target.scrollIntoView({ block: 'start' });
  };
  // Ir a un destino: las paradas de servicios viven en un carril horizontal, así que se calcula su scroll
  const go = (sel, opts) => {
    const el = typeof sel === 'string' ? document.getElementById(sel.replace(/^#/, '')) : sel;
    if (!el) return;
    if (el.classList.contains('station') && state.stationY) {
      const y = state.stationY(el.id);
      if (y != null) { scrollTo(y, opts); return; }
    }
    scrollTo(el, opts);
  };

  // Aviso breve
  const note = (text) => {
    let el = $('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(note.t);
    note.t = setTimeout(() => el.classList.remove('on'), 4200);
  };

  const ctx = { gsap, ScrollTrigger, motion, fine, state, scrollTo, go, getScroll, getVelocity, note };

  // Módulos en el orden del documento (los fijados deben crearse de arriba abajo)
  safe('el cielo', () => initStars(ctx));
  const hero = safe('el despegue', () => initHero(ctx));
  safe('la telemetría', () => initTelemetry(ctx));
  safe('el manifiesto', () => initManifesto(ctx));
  safe('el caos', () => initChaos(ctx));
  safe('los servicios', () => initServices(ctx));
  safe('el globo', () => initGlobe(ctx));
  safe('los resultados', () => initResults(ctx));
  safe('el escáner', () => initScan(ctx));
  safe('el plan de vuelo', () => initFlight(ctx));
  safe('el comparador', () => initCompare(ctx));
  safe('la misión', () => initMission(ctx));
  safe('las dudas', () => initFaq(ctx));
  safe('el contacto', () => initContact(ctx));
  safe('el pie', () => initFooter(ctx));
  safe('los titulares', () => initDecode(ctx));

  // Las animaciones CSS en bucle (pulsos, giros, flechas…) solo trabajan en lo que está a la vista:
  // cada capítulo, cada parada del carril de servicios y el pie se marcan con .off al salir de pantalla
  if (motion && 'IntersectionObserver' in W) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.target.classList.toggle('off', !e.isIntersecting)), { rootMargin: '10% 0px' });
    $$('main > section, #svcTrack > *, footer').forEach((el) => io.observe(el));
  }

  if (motion && hero) {
    ScrollTrigger.create({ trigger: '#despegue', start: 'top top', end: 'bottom top', scrub: true, onUpdate: (s) => hero.scroll(s.progress) });
    gsap.to('.hero-inner', { yPercent: -28, opacity: 0, ease: 'none', scrollTrigger: { trigger: '#despegue', start: 'top top', end: '80% top', scrub: true } });
    gsap.to('.horizon', { y: () => W.innerHeight * 0.32, ease: 'none', scrollTrigger: { trigger: '#despegue', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('#heroGL', { opacity: 0.15, ease: 'none', scrollTrigger: { trigger: '#despegue', start: '55% top', end: 'bottom top', scrub: true } });
  }

  // X25 · Escenas, carril con cuenta atrás y barra de progreso
  const chapters = $$('main > section.chapter');
  const named = chapters.filter((s) => s.dataset.chapter);
  const launchIdx = named.findIndex((s) => s.id === 'contacto');
  const railList = $('#railList');
  const railT = $('#railT');
  const railName = $('#railName');
  const tLabel = (i) => 'T−' + String(Math.max(0, launchIdx - i)).padStart(2, '0');
  named.forEach((s, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<a href="#${s.id}" aria-label="${tLabel(i)} · ${s.dataset.chapter}" title="${tLabel(i)} · ${s.dataset.chapter}"><i></i></a>`;
    railList.appendChild(li);
  });
  const railLinks = $$('a', railList);
  let curChapter = null;
  let launched = false;
  let inOrbit = false;
  const paintT = () => {
    if (inOrbit) railT.textContent = S.main.orbit;
    else if (launched && curChapter && curChapter.id === 'contacto') railT.textContent = 'T+00';
    else railT.textContent = tLabel(Math.max(0, named.indexOf(curChapter)));
  };
  const setChapter = (sec) => {
    if (sec === curChapter) return;
    curChapter = sec;
    const i = named.indexOf(sec);
    railLinks.forEach((a, k) => { a.setAttribute('aria-current', String(k === i)); a.classList.toggle('done', k < i); });
    railName.textContent = sec.dataset.chapter;
    paintT();
    if (motion) gsap.fromTo([railT, railName], { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out', overwrite: true });
  };
  state.onLaunch = () => { launched = true; railName.textContent = S.main.launched; paintT(); };
  const setScene = (s) => { if (html.dataset.scene !== s) html.dataset.scene = s; };
  setChapter(named[0]);
  if (libs) {
    // Manda la sección que cruza el centro; si un salto se salta alguna, manda la última que se ha pasado
    const scenes = chapters.filter((sec) => sec.getClientRects().length);
    const sts = [];
    const syncScene = () => {
      let k = 0;
      let on = -1;
      for (let i = 0; i < sts.length; i++) {
        if (sts[i].isActive) on = i;
        if (sts[i].scroll() >= sts[i].start) k = i;
      }
      if (on >= 0) k = on;
      setScene(scenes[k].dataset.scene || 'space');
      for (let i = k; i >= 0; i--) if (scenes[i].dataset.chapter) { setChapter(scenes[i]); break; }
    };
    scenes.forEach((sec) => sts.push(ScrollTrigger.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%', onToggle: syncScene })));
    ScrollTrigger.addEventListener('refresh', syncScene);
    ScrollTrigger.create({ trigger: '#base', start: 'top 60%', onToggle: (s) => { inOrbit = s.isActive; paintT(); } });
    const bar = document.createElement('div');
    bar.className = 'progress-top';
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<i></i>';
    document.body.appendChild(bar);
    const barI = bar.firstChild;
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => { barI.style.transform = `scaleX(${s.progress.toFixed(4)})`; } });
  }

  // Menú
  const menu = $('#menu');
  const btnMenu = $('#btnMenu');
  const closeMenu = () => {
    if (menu.hidden) return;
    menu.hidden = true;
    btnMenu.setAttribute('aria-expanded', 'false');
    $('span', btnMenu).textContent = S.main.menu;
    lock.start();
    syncHdr();
  };
  const openMenu = () => {
    menu.hidden = false;
    btnMenu.setAttribute('aria-expanded', 'true');
    $('span', btnMenu).textContent = S.main.close;
    lock.stop();
    syncHdr();
    if (motion) {
      gsap.fromTo(menu, { clipPath: 'circle(0% at 100% 0%)' }, { clipPath: 'circle(150% at 100% 0%)', duration: 0.8, ease: 'expo.out' });
      gsap.fromTo($$('nav a', menu), { yPercent: 70, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: 0.04, duration: 0.6, ease: 'expo.out', delay: 0.1 });
    }
    const first = $('a', menu);
    if (first) first.focus({ preventScroll: true });
  };
  btnMenu.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));
  menu.setAttribute('data-lenis-prevent', '');
  $$('.menu-tools [data-act]', menu).forEach((b) => b.addEventListener('click', () => {
    closeMenu();
    const target = document.getElementById(b.dataset.act);
    if (target) target.click();
  }));

  // Enlaces internos con scroll suave
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    const target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    closeMenu();
    go(target);
    if (a.classList.contains('skip')) {
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
  });

  // Cabecera: se esconde al bajar, vuelve al subir y fuera de la portada lleva fondo propio
  const hdr = $('#hdr');
  let hdrY = W.scrollY;
  let hdrAcc = 0;
  const syncHdr = () => {
    const y = W.scrollY;
    const dy = y - hdrY;
    hdrY = y;
    hdr.classList.toggle('is-solid', y > 80 && menu.hidden);
    if (y < 80 || !menu.hidden || hdr.querySelector(':focus-visible')) {
      hdrAcc = 0;
      hdr.classList.remove('is-up');
      return;
    }
    if (dy && Math.sign(dy) !== Math.sign(hdrAcc)) hdrAcc = 0;
    hdrAcc += dy;
    if (hdrAcc > 30) hdr.classList.add('is-up');
    else if (hdrAcc < -30) hdr.classList.remove('is-up');
  };
  W.addEventListener('scroll', syncHdr, { passive: true });
  hdr.addEventListener('focusin', () => hdr.classList.remove('is-up'));
  syncHdr();

  // Sonido opcional
  const btnSound = $('#btnSound');
  const toggleSound = async () => {
    if (sound.on) {
      sound.disable();
      btnSound.setAttribute('aria-pressed', 'false');
      btnSound.title = S.main.soundEnable;
      note(S.main.soundOff);
    } else if (await sound.enable()) {
      btnSound.setAttribute('aria-pressed', 'true');
      btnSound.title = S.main.soundMute;
      sound.chord();
      note(S.main.soundOn);
    }
  };
  btnSound.addEventListener('click', toggleSound);

  // Reducir movimiento (se guarda y se recarga)
  const btnMotion = $('#btnMotion');
  btnMotion.setAttribute('aria-pressed', String(!motion));
  btnSound.title = S.main.soundEnable;
  btnMotion.title = motion ? S.main.motionReduce : S.main.motionEnable;
  const toggleMotion = () => {
    const want = motion ? 'reduced' : 'full';
    store.set('ix-motion', want);
    setTimeout(() => note(S.main.reload), 2500);
    if (store.get('ix-motion') === want && !params.has('reducido')) { location.reload(); return; }
    const u = new URL(location.href);
    if (want === 'reduced') u.searchParams.set('reducido', '1');
    else u.searchParams.delete('reducido');
    location.href = u.toString();
  };
  btnMotion.addEventListener('click', toggleMotion);

  // Botones magnéticos (con el puntero normal del sistema)
  if (fine && motion) {
    $$('.magnetic').forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.28);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.38);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  // X01 · Secuencia de lanzamiento
  const pre = $('#pre');
  const preCount = $('#preCount');
  const preK = $('.pre-k', pre);
  const checks = $$('#preChecks li');
  const playIntro = () => {
    if (!motion) { if (hero) hero.intro(); return; }
    html.classList.add('is-loading');
    lock.stop();
    const R = Math.hypot(W.innerWidth, W.innerHeight) * 0.75;
    gsap.set(pre, { '--hole': '0px' });
    gsap.set('.pre-inner', { autoAlpha: 1, scale: 1 });
    gsap.set('#preBar', { scaleX: 0 });
    checks.forEach((li) => li.classList.remove('ok'));
    preK.textContent = S.main.preK;
    const tl = gsap.timeline({ onComplete: () => { html.classList.remove('is-loading'); lock.start(); } });
    ['T−03', 'T−02', 'T−01'].forEach((s, i) => tl.call(() => { preCount.textContent = s; sound.beep(660, 0.09); }, null, i * 0.5));
    checks.forEach((li, i) => tl.call(() => { li.classList.add('ok'); sound.tick(); }, null, 0.2 + i * 0.32));
    tl.call(() => { preCount.textContent = 'T−00'; preK.textContent = S.main.ignition; sound.beep(1320, 0.28); }, null, 1.5);
    tl.to('#preBar', { scaleX: 1, duration: 1.5, ease: 'none' }, 0);
    tl.to('.pre-inner', { autoAlpha: 0, scale: 1.1, duration: 0.35, ease: 'power2.in' }, 1.85);
    tl.to(pre, { '--hole': R + 'px', duration: 1.1, ease: 'expo.inOut' }, 1.95);
    tl.call(() => { if (hero) hero.intro(); sound.whoosh(); }, null, 2.1);
  };
  // Textos legales (ventana con pestañas; también se abren con #privacidad, #cookies, #aviso-legal o #condiciones)
  const legal = safe('los textos legales', () => initLegal({ lock }));

  // Cambio de idioma: la otra versión se abre en el mismo capítulo (y sin repetir la cuenta atrás)
  const langLinks = $$('[data-lang-switch]');
  const switchLang = () => {
    const a = langLinks[0];
    if (!a) return;
    W.location.href = a.getAttribute('href') + '#' + (curChapter ? curChapter.id : 'despegue');
  };
  langLinks.forEach((a) => a.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    e.preventDefault();
    switchLang();
  }));

  // X21 · Buscador
  const palette = safe('el buscador', () => initPalette({
    go,
    note,
    lock,
    actions: {
      sound: toggleSound,
      motion: toggleMotion,
      replay: () => { if (lenis) lenis.scrollTo(0, { immediate: true }); else W.scrollTo(0, 0); playIntro(); },
      legal: () => { if (legal) legal.open('privacy'); },
      lang: switchLang,
    },
  }));

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if ((palette && palette.isOpen) || (legal && legal.isOpen)) return;
    if (!menu.hidden) { closeMenu(); btnMenu.focus({ preventScroll: true }); }
  });

  const legalKey = legal ? legal.fromHash() : null;
  const hashTarget = !legalKey && location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  if (libs) {
    ScrollTrigger.refresh();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
    W.addEventListener('load', () => ScrollTrigger.refresh());
  }
  if (legalKey) {
    if (hero) hero.intro();
    W.scrollTo(0, 0);
    legal.open(legalKey);
  } else if (hashTarget) {
    if (hero) hero.intro();
    // Lenis guarda la altura de la página de antes de crear las secciones fijadas: se actualiza antes de saltar,
    // y se vuelve a aterrizar al terminar de cargar (salvo que la persona ya se haya movido por su cuenta)
    let moved = false;
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((ev) => W.addEventListener(ev, () => { moved = true; }, { once: true, passive: true }));
    const land = () => {
      if (moved) return;
      if (lenis) lenis.resize();
      go(hashTarget, { immediate: true });
    };
    requestAnimationFrame(land);
    const loaded = new Promise((r) => (document.readyState === 'complete' ? r() : W.addEventListener('load', r, { once: true })));
    Promise.all([loaded, document.fonts && document.fonts.ready]).then(() => requestAnimationFrame(() => requestAnimationFrame(land)));
  } else {
    W.scrollTo(0, 0);
    playIntro();
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
