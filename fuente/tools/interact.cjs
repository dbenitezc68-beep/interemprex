// Prueba de interacciones en ordenador: node fuente/tools/interact.cjs [es|en] [carpeta-capturas]
// El envío a Web3Forms está simulado (lib.cjs): ninguna prueba manda un email de verdad.
const path = require('path');
const fs = require('fs');
const { loadPlaywright, ARGS, serve, guard, fields, sleep } = require('./lib.cjs');
const { chromium } = loadPlaywright();

const lang = process.argv[2] === 'en' ? 'en' : 'es';
const outDir = path.resolve(process.argv[3] || path.join(__dirname, '..', 'out', 'interact-' + lang));
fs.mkdirSync(outDir, { recursive: true });
const T = lang === 'en'
  ? { path: 'en/', other: 'es', auto: /automation/i, qAuto: 'automation', qIntl: 'international', qLegal: 'privacy', code: 'Mission IX-DIS-2M', reto: /distribution/, q: 'cancel', ans: /15 days/, abort: /aborted/, orbit: /ORBIT/, hold: 'Hold to launch', plain: 'Send message', subject: '[INTEREMPREX web · EN] Ana Prueba — Web & Ecommerce', hash: '#privacy' }
  : { path: '', other: 'en', auto: /Automatizaci/, qAuto: 'automatizacion', qIntl: 'internacional', qLegal: 'privacidad', code: 'Misión IX-DIS-2M', reto: /distribución/, q: 'cancelar', ans: /15 días/, abort: /abortado/, orbit: /ÓRBITA/, hold: 'Mantén pulsado para lanzar', plain: 'Enviar mensaje', subject: '[INTEREMPREX web] Ana Prueba — Web & Ecommerce', hash: '#privacidad' };
const results = [];
let bad = 0;
const check = (name, ok, extra = '') => {
  const l = `${ok ? 'OK ' : 'MAL'} · ${name}${extra ? ' · ' + extra : ''}`;
  if (!ok) bad++;
  results.push(l);
  console.log(l);
};

(async () => {
  const { server, url } = await serve();
  const home = url + T.path;
  const browser = await chromium.launch({ args: ARGS });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const sent = await guard(page);
  const logs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/net::ERR_|Failed to load resource/.test(m.text())) logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  await page.goto(home);
  await sleep(4500);
  const shot = (n) => page.screenshot({ path: path.join(outDir, n + '.png') });
  const settle = async () => {
    let last = -1;
    let same = 0;
    for (let i = 0; i < 60 && same < 3; i++) {
      const y = await page.evaluate(() => Math.round(scrollY));
      same = y === last ? same + 1 : 0;
      last = y;
      await sleep(250);
    }
  };
  const jump = async (sel, f = 0) => {
    const y = await page.evaluate(([s, k]) => { const el = document.querySelector(s); const r = el.getBoundingClientRect(); return Math.min(document.documentElement.scrollHeight - innerHeight, r.top + scrollY + Math.max(0, r.height - innerHeight) * k); }, [sel, f]);
    const from = await page.evaluate(() => scrollY);
    const steps = Math.max(1, Math.min(14, Math.round(Math.abs(y - from) / 700)));
    for (let s = 1; s <= steps; s++) { await page.evaluate((v) => scrollTo(0, v), from + ((y - from) * s) / steps); await sleep(60); }
    await sleep(1600);
  };
  // La cabecera se esconde al bajar: se enfoca primero para que vuelva (como al tabular)
  const hdrClick = async (sel) => { await page.focus(sel); await sleep(500); await page.click(sel); };
  const inView = (sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width) }; }, sel);
  const palette = async (q) => {
    await page.keyboard.press('Control+K');
    await sleep(300);
    await page.keyboard.type(q, { delay: 20 });
    await sleep(200);
    const first = await page.evaluate(() => { const o = document.querySelector('#cmdkList [aria-selected="true"]'); return o ? o.textContent : ''; });
    await page.keyboard.press('Enter');
    await sleep(600);
    await settle();
    await sleep(900);
    return first;
  };
  const hold = async (ms = 1500) => {
    const bb = await (await page.$('#holdBtn')).boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.down();
    await sleep(ms);
    await page.mouse.up();
  };
  const fill = async () => {
    await page.fill('#fNombre', 'Ana Prueba');
    await page.fill('#fEmpresa', 'Ejemplo SL');
    await page.fill('#fEmail', 'ana@ejemplo.com');
    await page.selectOption('#fServicio', 'web');
    await page.fill('#fReto', 'Quiero vender por internet sin perder tiempo');
    await sleep(300);
  };
  const legalState = () => page.evaluate(() => {
    const d = document.getElementById('legal');
    const tab = d.querySelector('[role="tab"][aria-selected="true"]');
    const vis = [...d.querySelectorAll('[role="tabpanel"]')].filter((p) => !p.hidden).map((p) => p.id);
    return { open: d.open, tab: tab && tab.dataset.legalTab, vis: vis.join(','), focus: document.activeElement && (document.activeElement.id || document.activeElement.className), cls: document.documentElement.classList.contains('legal-open') };
  });

  // 1 · Portada: planetas desde la leyenda y con el cursor
  await page.hover('#heroLegend a[data-planet="1"]');
  await sleep(500);
  const tip = await page.evaluate(() => ({ on: document.getElementById('orbitTip').classList.contains('on'), t: document.querySelector('#orbitTip .ot-t').textContent }));
  check('Leyenda enciende su planeta', tip.on && T.auto.test(tip.t), tip.t);
  await page.mouse.move(700, 120);
  await sleep(400);
  const lab = await page.evaluate(() => {
    const s = document.querySelectorAll('#planetLabels span')[3];
    const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(s.style.transform);
    return m ? [+m[1], +m[2]] : null;
  });
  let planetHover = false;
  if (lab) {
    for (const dx of [-22, -30, -14, -40]) {
      await page.mouse.move(lab[0] + dx, lab[1] + 7);
      await sleep(350);
      planetHover = await page.evaluate(() => document.getElementById('orbitTip').classList.contains('on'));
      if (planetHover) break;
    }
  }
  await shot('i01-planeta');
  check('Cursor sobre un planeta muestra su ficha', planetHover, await page.textContent('#orbitTip .ot-t'));
  if (planetHover) {
    await page.mouse.down();
    await page.mouse.up();
    await sleep(800); await settle(); await sleep(800);
    const st = await inView('#s-intl');
    check('Clic en el planeta lleva a su parada', st.l > -200 && st.l < 400, `left ${st.l}`);
  }

  // 2 · Buscador y web que se construye
  let first = await palette('web ecommerce');
  let st = await inView('#s-web');
  check('Buscador → Web & Ecommerce', /Web & Ecommerce/.test(first) && st.l > -200 && st.l < 400, `${first.trim()} · left ${st.l}`);
  await page.click('.seg button[data-state="live"]');
  await sleep(1200);
  check('Navegador pasa a publicada', (await page.getAttribute('#browser', 'data-state')) === 'live');
  await shot('i02-web');

  // 3 · Flujo manual / automático
  first = await palette(T.qAuto);
  await page.click('[role="radio"][data-mode="auto"]');
  await sleep(1500);
  const flow = await page.evaluate(() => ({ m: document.getElementById('flow').dataset.mode, s: document.getElementById('flowStatus').textContent }));
  check('Flujo en automático', flow.m === 'auto', flow.s);
  await shot('i03-flujo');

  // 4 · Señal contra ruido
  first = await palette('marketing');
  await page.evaluate(() => { const r = document.getElementById('scopeKnob'); r.value = '100'; r.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(1500);
  const noise = await page.textContent('#scopeNoise');
  check('El mando quita el ruido', parseInt(noise, 10) <= 10, noise);
  await shot('i04-senal');

  // 5 · Globo que se arrastra
  first = await palette(T.qIntl);
  const gb = await (await page.$('#globe')).boundingBox();
  await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(gb.x + gb.width / 2 + i * 20, gb.y + gb.height / 2 + i * 4); await sleep(40); }
  await page.mouse.up();
  await sleep(800);
  await shot('i05-globo');
  check('Globo arrastrable sin errores', logs.length === 0, logs[0] || '');

  // 6 · Comparador
  await jump('#comparador', 0.5);
  await sleep(3600);
  const cb = await (await page.$('#cmp')).boundingBox();
  await page.mouse.move(cb.x + cb.width * 0.5, cb.y + cb.height * 0.5);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) { await page.mouse.move(cb.x + cb.width * (0.5 - i * 0.05), cb.y + cb.height * 0.5); await sleep(40); }
  await page.mouse.up();
  await sleep(400);
  const pos = await page.evaluate(() => getComputedStyle(document.getElementById('cmp')).getPropertyValue('--pos').trim());
  check('Comparador arrastrable', Math.abs(parseFloat(pos) - 20) < 3, pos);
  await shot('i06-comparador');

  // 7 · Configura tu misión → formulario
  await jump('#mision');
  await page.click('label:has(input[name="tipo"][value="distribucion"])');
  await page.click('label:has(input[name="meta"][value="web"])');
  await page.click('label:has(input[name="meta"][value="auto"])');
  await page.click('label:has(input[name="meta"][value="intl"])');
  await page.evaluate(() => { const r = document.getElementById('cfgWhen'); r.value = '1'; r.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(900);
  // Como una persona: primero se ve el botón y luego se pulsa (Playwright no espera al evento de scroll)
  await page.evaluate(() => document.getElementById('cfgSend').scrollIntoView({ block: 'center' }));
  await sleep(700);
  const cfg = await page.evaluate(() => ({ code: document.getElementById('cfgCode').textContent, start: document.getElementById('cfgStart').textContent, then: document.getElementById('cfgThen').textContent }));
  check('Parche de misión', cfg.code === T.code, `${cfg.code} · ${cfg.start} · ${cfg.then}`);
  await shot('i07-mision');
  await page.click('#cfgSend');
  await sleep(1000); await settle(); await sleep(1200);
  const pre = await page.evaluate(() => ({ s: document.getElementById('fServicio').value, r: document.getElementById('fReto').value, t: Math.round(document.getElementById('contacto').getBoundingClientRect().top), focus: document.activeElement && document.activeElement.id }));
  check('Lleva lo elegido al formulario', pre.s === 'varios' && T.reto.test(pre.r) && Math.abs(pre.t) < 140, `${pre.s} · «${pre.r}» · top ${pre.t} · foco ${pre.focus}`);

  // 8 · Consola de dudas
  await jump('#dudas');
  await page.click('#termIn');
  await page.keyboard.type(T.q, { delay: 20 });
  await page.keyboard.press('Enter');
  await sleep(3500);
  const ans = await page.evaluate(() => { const a = document.querySelectorAll('#termLog p.a'); return a.length ? a[a.length - 1].textContent : ''; });
  check('Consola responde por palabras', T.ans.test(ans), ans.slice(0, 70));
  await shot('i08-dudas');

  // 9 · Formulario: aborto sin datos
  await jump('#contacto');
  await page.fill('#fNombre', '');
  await page.fill('#fEmail', '');
  await page.selectOption('#fServicio', '');
  await page.fill('#fReto', '');
  await hold();
  await sleep(500);
  const abortNote = await page.evaluate(() => ({ err: document.getElementById('lfNote').classList.contains('err'), t: document.getElementById('lfNote').textContent }));
  check('Sin datos se aborta el lanzamiento', abortNote.err && T.abort.test(abortNote.t) && sent.sent.length === 0, abortNote.t);
  await shot('i09-abortado');

  // 10 · Envío correcto: lo que llega a Web3Forms
  await fill();
  const fuel = await page.textContent('#fuelPct');
  check('Depósito lleno al completar', fuel.trim() === '100%', fuel);
  const bb = await (await page.$('#holdBtn')).boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  await sleep(400);
  const counting = await page.textContent('#holdTxt');
  await sleep(1000);
  await page.mouse.up();
  await sleep(150);
  const sending = await page.evaluate(() => ({ t: document.getElementById('holdTxt').textContent, busy: document.getElementById('holdBtn').getAttribute('aria-busy') }));
  await sleep(600);
  await shot('i10-despegue');
  await sleep(1600);
  const okState = await page.evaluate(() => ({ ok: !document.getElementById('launchOk').hidden, rail: document.getElementById('railT').textContent }));
  check('Mantén pulsado → se envía y despega', okState.ok && sent.sent.length === 1, `${counting} · ${sending.t} (ocupado ${sending.busy}) · carril ${okState.rail}`);
  const f = sent.sent.length ? fields(sent.sent[0].body) : {};
  check('Campos enviados', sent.sent.length === 1 && sent.sent[0].method === 'POST' && /^[0-9a-f-]{36}$/.test(f.access_key || '') && f.subject === T.subject && f.service === 'Web & Ecommerce' && f.language === lang.toUpperCase() && f.name === 'Ana Prueba' && f.company === 'Ejemplo SL' && f.email === 'ana@ejemplo.com' && /vender/.test(f.message || '') && f.from_name === 'Web INTEREMPREX' && !('botcheck' in f),
    `${f.subject} · ${f.service} · ${f.language} · clave ${f.access_key ? 'sí' : 'no'} · trampa ${'botcheck' in f ? 'sí' : 'no'}`);
  await shot('i11-recibido');
  await page.click('#launchAgain');
  await sleep(400);
  check('Enviar otro limpia el formulario', await page.evaluate(() => !document.getElementById('launchForm').hidden && document.getElementById('fNombre').value === '' && document.getElementById('lfNote').textContent === ''));

  // 11 · Envío que falla (el servicio responde error / sin conexión): conserva los datos y ofrece email y WhatsApp
  for (const mode of ['fail', 'offline']) {
    sent.mode = mode;
    await fill();
    const before = sent.sent.length;
    await hold();
    await sleep(1500);
    const fs2 = await page.evaluate(() => {
      const n = document.getElementById('lfNote');
      return { err: n.classList.contains('err'), mail: !!n.querySelector('a[href^="mailto:"]'), wa: !!n.querySelector('a[href^="https://wa.me/"]'), form: !document.getElementById('launchForm').hidden, ok: !document.getElementById('launchOk').hidden, name: document.getElementById('fNombre').value, txt: document.getElementById('holdTxt').textContent };
    });
    check(`Fallo de envío (${mode === 'fail' ? 'error del servicio' : 'sin conexión'})`, sent.sent.length === before + 1 && fs2.err && fs2.mail && fs2.wa && fs2.form && !fs2.ok && fs2.name === 'Ana Prueba' && fs2.txt === T.hold, `aviso ${fs2.err} · datos ${fs2.name} · botón «${fs2.txt}»`);
    await shot('i12-fallo-' + mode);
  }
  sent.mode = 'ok';
  await hold();
  await sleep(3200);
  check('Reintento tras el fallo', await page.evaluate(() => !document.getElementById('launchOk').hidden), `${sent.sent.length} envíos simulados`);
  await page.click('#launchAgain');
  await sleep(300);

  // 12 · Pie: carril en órbita y textos legales
  await jump('#base', 1);
  await sleep(600);
  const rail = await page.textContent('#railT');
  check('Carril en órbita al llegar al pie', T.orbit.test(rail), rail);
  await page.click('.foot-col .legal-link[data-legal="cookies"]');
  await sleep(500);
  let lg = await legalState();
  check('Pie → textos legales en la pestaña de cookies', lg.open && lg.tab === 'cookies' && lg.vis === 'lp-cookies' && lg.focus === 'lt-cookies' && lg.cls, `${lg.tab} · ${lg.vis} · foco ${lg.focus}`);
  await shot('i13-legal');
  await page.keyboard.press('ArrowRight');
  await sleep(200);
  lg = await legalState();
  check('Flechas cambian de pestaña', lg.tab === 'legal' && lg.vis === 'lp-legal' && lg.focus === 'lt-legal', lg.tab);
  const scrolled = await page.evaluate(() => { const b = document.getElementById('legalBody'); b.scrollTop = 400; return b.scrollTop; });
  await page.keyboard.press('Escape');
  await sleep(400);
  lg = await legalState();
  const backFocus = await page.evaluate(() => document.activeElement && document.activeElement.dataset.legal);
  check('Escape cierra y devuelve el foco', !lg.open && !lg.cls && backFocus === 'cookies', `foco en ${backFocus} · el texto se desplaza ${scrolled}px`);
  await jump('#contacto');
  await page.click('.lf-legal .legal-link');
  await sleep(500);
  lg = await legalState();
  check('Aviso del formulario → privacidad', lg.open && lg.tab === 'privacy' && lg.vis === 'lp-privacy', lg.tab);
  await page.mouse.click(20, 450);
  await sleep(400);
  check('Clic fuera de la caja cierra', !(await legalState()).open);
  await palette(T.qLegal);
  lg = await legalState();
  check('Buscador → textos legales', lg.open && lg.tab === 'privacy', lg.tab);
  await page.click('#legalClose');
  await sleep(300);
  check('Botón cerrar', !(await legalState()).open);

  // 13 · Cabecera y sonido
  await jump('#base', 1);
  const hdrUp = await page.evaluate(() => document.getElementById('hdr').classList.contains('is-up'));
  await page.mouse.wheel(0, -400);
  await sleep(1200);
  const hdrBack = await page.evaluate(() => !document.getElementById('hdr').classList.contains('is-up'));
  check('Cabecera se esconde al bajar y vuelve al subir', hdrUp && hdrBack);
  await hdrClick('#btnSound');
  await sleep(400);
  check('Botón de sonido', (await page.getAttribute('#btnSound', 'aria-pressed')) === 'true');
  await hdrClick('#btnSound');

  // 14 · Cambio de idioma: va a la otra versión en la misma sección y sin cuenta atrás
  await jump('#proceso', 0.3);
  await Promise.all([page.waitForNavigation({ timeout: 15000 }).catch(() => null), hdrClick('#btnLang')]);
  await sleep(2500);
  const sw = await page.evaluate(() => ({ lang: document.documentElement.lang, hash: location.hash, path: location.pathname, loading: document.documentElement.classList.contains('is-loading'), top: Math.round(document.getElementById('proceso').getBoundingClientRect().top) }));
  check('Selector de idioma', sw.lang === T.other && sw.hash === '#proceso' && !sw.loading && Math.abs(sw.top) < 60, `${sw.path}${sw.hash} · lang ${sw.lang} · sección a ${sw.top}px`);
  await shot('i14-idioma');

  // 15 · Enlace directo a los textos legales
  await page.goto(home + T.hash);
  await sleep(1500);
  lg = await legalState();
  const loading = await page.evaluate(() => document.documentElement.classList.contains('is-loading'));
  check(`Enlace directo ${T.hash}`, lg.open && lg.tab === 'privacy' && !loading, lg.tab);
  await page.keyboard.press('Escape');
  await sleep(300);

  // 16 · Versión sin movimiento: el botón envía al momento
  await page.goto(home);
  await sleep(4500);
  await Promise.all([page.waitForNavigation({ timeout: 15000 }).catch(() => null), hdrClick('#btnMotion')]);
  await sleep(2500);
  const red = await page.evaluate(() => ({ r: document.documentElement.classList.contains('reduced'), btn: document.getElementById('holdTxt').textContent }));
  check('Botón «Movimiento» pasa a la versión sin animaciones', red.r && red.btn === T.plain, red.btn);
  await jump('#contacto');
  await fill();
  const n0 = sent.sent.length;
  await page.click('#holdBtn');
  await sleep(1200);
  check('Sin movimiento: un clic envía', sent.sent.length === n0 + 1 && (await page.evaluate(() => !document.getElementById('launchOk').hidden)));
  await shot('i15-reducido');

  // 17 · Sin JavaScript el formulario se envía igual (envío nativo, también simulado)
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  const p2 = await ctx2.newPage();
  const sent2 = await guard(p2);
  await p2.goto(home + '#contacto');
  await p2.fill('#fNombre', 'Ana Prueba');
  await p2.fill('#fEmail', 'ana@ejemplo.com');
  await p2.selectOption('#fServicio', 'auto');
  await p2.fill('#fReto', 'Quiero automatizar pedidos');
  await Promise.all([p2.waitForNavigation({ timeout: 10000 }).catch(() => null), p2.click('#holdBtn')]);
  const f2 = sent2.sent.length ? sent2.sent[0].body : '';
  check('Sin JavaScript: envío nativo con la clave', sent2.sent.length === 1 && /access_key=[0-9a-f-]{36}/.test(f2) && /name=Ana\+Prueba/.test(f2) && /service=auto/.test(f2), f2 ? f2.replace(/access_key=[^&]+/, 'access_key=…').slice(0, 120) : '(nada)');
  await ctx2.close();

  check('Consola sin errores', logs.length === 0, logs.slice(0, 3).join(' | '));
  fs.writeFileSync(path.join(outDir, 'resultados.txt'), results.join('\n') + '\n\nConsola:\n' + (logs.join('\n') || '(sin errores)') + '\n');
  await browser.close();
  server.close();
  console.log(bad ? `${bad} comprobaciones fallidas` : 'Todo correcto');
  process.exit(bad ? 1 : 0);
})();
