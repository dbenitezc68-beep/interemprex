// Interacciones en móvil (táctil): node fuente/tools/interact-mobile.cjs [es|en] [carpeta-capturas]
// El envío a Web3Forms está simulado (lib.cjs): ninguna prueba manda un email de verdad.
const path = require('path');
const fs = require('fs');
const { loadPlaywright, ARGS, serve, guard, fields, sleep } = require('./lib.cjs');
const { chromium } = loadPlaywright();

const lang = process.argv[2] === 'en' ? 'en' : 'es';
const outDir = path.resolve(process.argv[3] || path.join(__dirname, '..', 'out', 'interact-mobile-' + lang));
fs.mkdirSync(outDir, { recursive: true });
const other = lang === 'en' ? 'es' : 'en';
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
  const home = url + (lang === 'en' ? 'en/' : '');
  const browser = await chromium.launch({ args: ARGS });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
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
  const jump = async (sel) => {
    const y = await page.evaluate((s) => document.querySelector(s).getBoundingClientRect().top + scrollY, sel);
    const from = await page.evaluate(() => scrollY);
    const steps = Math.max(1, Math.min(16, Math.round(Math.abs(y - from) / 700)));
    for (let s = 1; s <= steps; s++) { await page.evaluate((v) => scrollTo(0, v), from + ((y - from) * s) / steps); await sleep(60); }
    await sleep(1500);
  };

  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check('Sin desplazamiento lateral', over <= 0, `${over}px`);

  // Menú
  await page.tap('#btnMenu');
  await sleep(900);
  const menuOpen = await page.evaluate(() => !document.getElementById('menu').hidden);
  await shot('m01-menu');
  await page.tap('#menu nav a[href="#proceso"]');
  await sleep(800); await settle(); await sleep(600);
  const mp = await page.evaluate(() => ({ hidden: document.getElementById('menu').hidden, t: Math.round(document.getElementById('proceso').getBoundingClientRect().top) }));
  check('Menú abre y lleva a la sección', menuOpen && mp.hidden && Math.abs(mp.t) < 120, `top ${mp.t}`);

  // Leyenda de la portada → parada de servicios
  await page.evaluate(() => scrollTo(0, 0));
  await sleep(1500);
  await page.tap('#heroLegend a[href="#s-mktg"]');
  await sleep(800); await settle(); await sleep(800);
  const st = await page.evaluate(() => Math.round(document.getElementById('s-mktg').getBoundingClientRect().left));
  check('Leyenda lleva a Marketing', Math.abs(st) < 60, `left ${st}`);
  await shot('m02-marketing');

  // Comparador con el dedo (eventos de puntero táctiles)
  await jump('#comparador');
  await sleep(3500);
  const box = await (await page.$('#cmp')).boundingBox();
  await page.dispatchEvent('#cmp', 'pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0, clientX: box.x + box.width * 0.5, clientY: box.y + box.height * 0.5 });
  for (let i = 1; i <= 5; i++) await page.dispatchEvent('#cmp', 'pointermove', { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: box.x + box.width * (0.5 + i * 0.06), clientY: box.y + box.height * 0.5 });
  await page.dispatchEvent('#cmp', 'pointerup', { pointerId: 7, pointerType: 'touch', isPrimary: true });
  await sleep(400);
  const pos = await page.evaluate(() => getComputedStyle(document.getElementById('cmp')).getPropertyValue('--pos').trim());
  check('Comparador con el dedo', Math.abs(parseFloat(pos) - 80) < 3, pos);
  await shot('m03-comparador');

  // Formulario y despegue con el dedo (envío simulado)
  await jump('#contacto');
  await page.fill('#fNombre', 'Ana Prueba');
  await page.fill('#fEmail', 'ana@ejemplo.com');
  await page.selectOption('#fServicio', 'auto');
  await page.fill('#fReto', 'Paso pedidos a mano del Excel al ERP');
  await page.evaluate(() => document.getElementById('holdBtn').scrollIntoView({ block: 'center' }));
  await sleep(1200);
  await page.dispatchEvent('#holdBtn', 'pointerdown', { pointerId: 9, pointerType: 'touch', isPrimary: true, button: 0 });
  await sleep(1500);
  await page.dispatchEvent('#holdBtn', 'pointerup', { pointerId: 9, pointerType: 'touch', isPrimary: true, button: 0 });
  await sleep(2800);
  const ok = await page.evaluate(() => !document.getElementById('launchOk').hidden);
  const f = sent.sent.length ? fields(sent.sent[0].body) : {};
  check('Despegue con el dedo y envío', ok && sent.sent.length === 1 && f.service === 'Automatización de procesos' && f.language === lang.toUpperCase(), `${f.subject || '(sin envío)'}`);
  await shot('m04-recibido');

  // Textos legales en pantalla pequeña
  await jump('#base');
  await page.tap('.foot-col .legal-link[data-legal="terms"]');
  await sleep(700);
  const lg = await page.evaluate(() => {
    const d = document.getElementById('legal');
    const b = d.querySelector('.legal-box').getBoundingClientRect();
    const tabs = d.querySelector('.legal-tabs');
    const body = document.getElementById('legalBody');
    const before = body.scrollTop;
    body.scrollTop = 600;
    return { open: d.open, tab: d.querySelector('[aria-selected="true"]').dataset.legalTab, l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), tabsW: tabs.scrollWidth - tabs.clientWidth, scroll: body.scrollTop - before, over: document.documentElement.scrollWidth - innerWidth };
  });
  await shot('m05-legal');
  check('Textos legales caben en la pantalla', lg.open && lg.tab === 'terms' && lg.l >= 0 && lg.r <= 390 && lg.t >= 0 && lg.b <= 844 && lg.scroll > 0 && lg.over <= 0, `caja ${lg.l}–${lg.r} × ${lg.t}–${lg.b} · pestañas desbordan ${lg.tabsW}px · texto desplazable ${lg.scroll}px`);
  await page.tap('#legalClose');
  await sleep(500);
  check('Se cierran con el botón', await page.evaluate(() => !document.getElementById('legal').open));

  // Idioma desde el menú (la cabecera se esconde al bajar: se sube un poco para que vuelva)
  await page.mouse.wheel(0, -300);
  await sleep(1200);
  await page.tap('#btnMenu');
  await sleep(900);
  await Promise.all([page.waitForNavigation({ timeout: 15000 }).catch(() => null), page.tap('#menu a[data-lang-switch]')]);
  await sleep(2500);
  const sw = await page.evaluate(() => ({ lang: document.documentElement.lang, hash: location.hash, loading: document.documentElement.classList.contains('is-loading'), over: document.documentElement.scrollWidth - innerWidth }));
  check('Cambio de idioma desde el menú', sw.lang === other && sw.hash.length > 1 && !sw.loading && sw.over <= 0, `${sw.lang} ${sw.hash}`);
  await shot('m06-idioma');

  check('Consola sin errores', logs.length === 0, logs.slice(0, 3).join(' | '));
  fs.writeFileSync(path.join(outDir, 'resultados.txt'), results.join('\n') + '\n\nConsola:\n' + (logs.join('\n') || '(sin errores)') + '\n');
  await browser.close();
  server.close();
  console.log(bad ? `${bad} comprobaciones fallidas` : 'Todo correcto');
  process.exit(bad ? 1 : 0);
})();
