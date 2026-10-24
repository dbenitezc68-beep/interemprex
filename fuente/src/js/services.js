import { $, $$, clamp, onVisible, svgEl, pathSampler } from './util.js';
import { sound } from './sound.js';
import { S } from './i18n.js';

// X08 · Viaje por los servicios: carril horizontal fijado con cuatro paradas
export function initServices({ gsap, ScrollTrigger, motion, state }) {
  const section = $('#servicios');
  const pin = $('.svc-pin', section);
  const track = $('#svcTrack');
  const stations = $$('.station', track);
  const map = $$('#svcMap li');
  initBrowser({ gsap, motion });
  initFlow({ motion });
  initScope({ gsap, motion });

  if (!motion) {
    state.stationY = null;
    return;
  }
  const dist = () => Math.max(0, track.scrollWidth - document.documentElement.clientWidth);
  let cur = -1;
  const setCur = (x) => {
    const vw = document.documentElement.clientWidth;
    let k = -1;
    stations.forEach((s, i) => { if (s.offsetLeft - x < vw * 0.5) k = i; });
    if (k === cur) return;
    cur = k;
    map.forEach((li, i) => li.classList.toggle('on', i === k));
    if (k >= 0) sound.whoosh();
  };
  const tween = gsap.to(track, {
    x: () => -dist(),
    ease: 'none',
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: () => '+=' + dist() * 1.15,
      pin,
      scrub: 0.8,
      invalidateOnRefresh: true,
      onUpdate: (s) => setCur(s.progress * dist()),
    },
  });
  // Posición de scroll que deja una parada centrada (para enlaces, planetas y buscador)
  state.stationY = (id) => {
    const el = document.getElementById(id);
    const i = stations.indexOf(el);
    if (i < 0) return null;
    const st = tween.scrollTrigger;
    const p = clamp(el.offsetLeft / (dist() || 1), 0, 1);
    return st.start + (st.end - st.start) * p;
  };
}

// X09 · Web que se construye sola: boceto, diseño y publicada (con pedidos que entran)
function initBrowser({ gsap, motion }) {
  const br = $('#browser');
  const btns = $$('#s-web .seg button');
  const cart = $('.br-cart', br);
  const count = $('#brCart');
  const cursor = $('.bp-cursor', br);
  const order = ['wire', 'design', 'live'];
  let n = 0;
  let auto = motion;
  let timer = 0;
  let k = 0;
  const set = (s) => {
    br.dataset.state = s;
    btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.state === s)));
    if (s === 'live') click();
  };
  const click = () => {
    if (!motion) { count.textContent = '1'; return; }
    const btn = $('.bp-btn', br);
    const page = $('.br-page', br);
    const pr = page.getBoundingClientRect();
    const r = btn.getBoundingClientRect();
    const tx = r.left - pr.left + r.width * 0.6;
    const ty = r.top - pr.top + r.height * 0.55;
    gsap.timeline()
      .set(cursor, { opacity: 1, left: '82%', top: '92%' })
      .to(cursor, { left: tx, top: ty, duration: 0.9, ease: 'power2.inOut' }, 0.3)
      .to(cursor, { scale: 0.8, duration: 0.1, yoyo: true, repeat: 1 })
      .call(() => {
        n = n >= 9 ? 1 : n + 1;
        count.textContent = String(n);
        cart.classList.remove('bump');
        void cart.offsetWidth;
        cart.classList.add('bump');
        sound.blip(1500, 0.03);
      })
      .to(cursor, { opacity: 0, duration: 0.4, delay: 0.5 });
  };
  btns.forEach((b) => b.addEventListener('click', () => { auto = false; set(b.dataset.state); }));
  if (!motion) { set('live'); return; }
  onVisible(br, (v) => {
    clearInterval(timer);
    if (!v || !auto) return;
    timer = setInterval(() => {
      if (!auto) { clearInterval(timer); return; }
      k = (k + 1) % order.length;
      set(order[k]);
    }, 2600);
  });
}

// X10 · Flujo manual contra automático: los pedidos recorren nodos; en manual se paran y se repiten
function initFlow({ motion }) {
  const flow = $('#flow');
  const svg = $('.flow-svg', flow);
  const packetsG = $('#flowPackets');
  const handsG = $('#flowHands');
  const status = $('#flowStatus');
  const btns = $$('#s-auto .seg button');
  const edges = ['fe0', 'fe1', 'fe2', 'fe3', 'fe4'].map((id) => $('#' + id, svg));
  const redo = $('#feR', svg);
  const lens = edges.map((e) => e.getTotalLength());
  const redoLen = redo.getTotalLength();
  // Posiciones de los tramos ya muestreadas (medir el trazado en cada fotograma es caro)
  const at = edges.map((e) => pathSampler(e, 120));
  const atRedo = pathSampler(redo, 160);
  const NODES = [[40, 80], [230, 80], [410, 80], [410, 230], [230, 230], [60, 230]];
  const WORDS = S.services.words;
  let mode = 'manual';
  let auto = motion;
  const packets = [];
  const hands = NODES.slice(1).map(([x, y], i) => {
    const t = svgEl('text', { x, y: y - 40 }, handsG);
    t.textContent = WORDS[i];
    t.style.opacity = '0';
    return t;
  });
  const setMode = (m, user) => {
    mode = m;
    flow.dataset.mode = m;
    btns.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === m)));
    status.textContent = m === 'auto' ? S.services.auto : S.services.manual;
    if (user) { auto = false; sound.tick(); }
  };
  btns.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode, true)));
  btns.forEach((b, i) => b.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const nb = btns[(i + 1) % btns.length];
    nb.focus();
    setMode(nb.dataset.mode, true);
  }));
  if (!motion) {
    // Paquetes quietos a mitad de cada tramo
    edges.forEach((e, i) => {
      const pt = e.getPointAtLength(lens[i] / 2);
      svgEl('circle', { cx: pt.x, cy: pt.y, r: 5 }, packetsG);
    });
    return;
  }
  const spawn = () => {
    const el = svgEl('circle', { r: 5 }, packetsG);
    packets.push({ el, edge: 0, t: 0, wait: 0, err: false, redo: false });
  };
  let acc = 0;
  let visible = false;
  let last = performance.now();
  let modeClock = 0;
  onVisible(flow, (v) => { visible = v; last = performance.now(); });
  const tick = (now) => {
    requestAnimationFrame(tick);
    if (!visible) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (auto) {
      modeClock += dt;
      if (mode === 'manual' && modeClock > 5) { setMode('auto'); modeClock = 0; }
      else if (mode === 'auto' && modeClock > 6) { setMode('manual'); modeClock = 0; }
    }
    const fast = mode === 'auto';
    acc += dt;
    if (acc > (fast ? 0.42 : 1.6) && packets.length < (fast ? 12 : 5)) { acc = 0; spawn(); }
    const speed = fast ? 260 : 70;
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i];
      if (p.wait > 0) {
        p.wait -= dt;
        continue;
      }
      const L = p.redo ? redoLen : lens[p.edge];
      p.t += (speed * dt) / L;
      if (p.t >= 1) {
        p.t = 0;
        if (p.redo) {
          // vuelve a Excel y repite el tramo Excel → ERP
          p.redo = false;
          p.edge = 1;
          p.err = false;
        } else {
          p.edge++;
          if (!fast && p.edge <= 4) {
            p.wait = 0.5;
            const h = hands[p.edge - 1];
            if (h) { h.style.opacity = '1'; setTimeout(() => { h.style.opacity = '0'; }, 420); }
            if (p.edge === 4 && Math.random() < 0.45) { p.redo = true; p.err = true; }
          }
        }
        if (p.edge > 4) {
          p.el.remove();
          packets.splice(i, 1);
          continue;
        }
      }
      const [x, y] = p.redo ? atRedo(p.t) : at[p.edge](p.t);
      p.el.setAttribute('cx', x.toFixed(1));
      p.el.setAttribute('cy', y.toFixed(1));
      p.el.classList.toggle('err', p.err && !fast);
    }
    if (fast) hands.forEach((h) => { h.style.opacity = '0'; });
  };
  requestAnimationFrame(tick);
}

// X11 · Señal contra ruido: osciloscopio con un mando que filtra el ruido
function initScope({ motion }) {
  const canvas = $('#scope');
  const ctx = canvas.getContext('2d');
  const knob = $('#scopeKnob');
  const knobI = $('#knobI');
  const noiseEl = $('#scopeNoise');
  const sigEl = $('#scopeSignal');
  let W = 0, H = 0, dpr = 1;
  let k = 0;
  let shownPct = -1;
  let user = false;
  let visible = false;
  let t = 0;
  const noise = new Float32Array(256).map(() => Math.random() * 2 - 1);
  const resize = () => {
    dpr = Math.min(1.75, window.devicePixelRatio || 1);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  };
  const setK = (v) => {
    k = clamp(v, 0, 1);
    const pct = Math.round(k * 100);
    // El mando y las cifras solo se tocan cuando cambia el porcentaje
    if (pct === shownPct) return;
    shownPct = pct;
    knob.value = String(pct);
    knob.style.setProperty('--fill', pct + '%');
    knob.setAttribute('aria-valuetext', S.services.knob(100 - pct, pct));
    knobI.style.setProperty('--a', -135 + k * 270 + 'deg');
    noiseEl.textContent = 100 - pct + '%';
    sigEl.textContent = pct + '%';
  };
  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // rejilla (un solo trazado)
    ctx.strokeStyle = 'rgba(167,139,250,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += W / 10) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = 0; y <= H; y += H / 6) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    const mid = H * 0.56;
    const amp = H * 0.22;
    const pts = [];
    for (let x = 0; x <= W; x += 3) {
      const u = x / W;
      const sig = Math.sin(u * Math.PI * 6 - t * 2.2) * amp;
      const i = ((x / 3 + t * 40) | 0) & 255;
      const nz = (noise[i] * 0.7 + noise[(i * 7) & 255] * 0.3) * amp * 1.4 * (1 - k) + Math.sin(u * 90 + t * 9) * amp * 0.25 * (1 - k);
      pts.push([x, mid - (sig * (0.25 + 0.75 * k) + nz)]);
    }
    const hue = k > 0.5 ? '167,139,250' : '248,113,113';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = `rgba(${hue},0.18)`;
    ctx.lineWidth = 7;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.strokeStyle = `rgba(${hue},0.95)`;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    // clientes reales: puntos en las crestas cuando hay señal
    if (k > 0.45) {
      const n = Math.round((k - 0.45) * 11);
      for (let j = 0; j < Math.min(n, 3); j++) {
        const phase = (t * 2.2) / (Math.PI * 6);
        const u = ((j * 2 + 0.25) / 6 + phase) % 1;
        const x = u * W;
        const y = mid - amp * (0.25 + 0.75 * k);
        ctx.fillStyle = 'rgba(167,139,250,0.25)';
        ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ede9fe';
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
  };
  resize();
  setK(motion ? 0 : 1);
  knob.addEventListener('input', () => { user = true; setK(Number(knob.value) / 100); if (!motion) draw(); });
  window.addEventListener('resize', () => { resize(); if (!motion) draw(); });
  if (!motion) { draw(); return; }
  onVisible(canvas, (v) => { visible = v; });
  let last = performance.now();
  const loopFn = (now) => {
    requestAnimationFrame(loopFn);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible) return;
    t += dt;
    if (!user) setK(0.5 - 0.5 * Math.cos(t * 0.75));
    if (canvas.clientWidth !== W) resize();
    draw();
  };
  requestAnimationFrame(loopFn);
}
