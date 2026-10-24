// Recorre la web con Chromium y guarda capturas de cada sección + errores de consola.
// Uso: node fuente/tools/shoot.cjs <carpeta-salida> [es|en] [desktop|mobile] [reducido]
const path = require('path');
const fs = require('fs');
const { loadPlaywright, ARGS, serve, guard, sleep } = require('./lib.cjs');
const { chromium } = loadPlaywright();

const outDir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out', 'capturas'));
const lang = process.argv[3] || 'es';
const kind = process.argv[4] || 'desktop';
const reduced = process.argv[5] === 'reducido';
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const { server, url } = await serve();
  const browser = await chromium.launch({ args: ARGS });
  const vp = kind === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const context = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: kind === 'mobile', hasTouch: kind === 'mobile', reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  await guard(page);
  const logs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  await page.goto(url + (lang === 'en' ? 'en/' : '') + (reduced ? '?reducido=1' : ''));
  await sleep(4200);
  const pre = `${lang}-${kind}${reduced ? '-red' : ''}`;
  await page.screenshot({ path: path.join(outDir, `${pre}-00-hero.png`) });

  // Posiciones de cada sección (con los espaciadores de los fijados ya aplicados)
  const marks = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('main > section, footer').forEach((s) => {
      const r = s.getBoundingClientRect();
      out.push({ id: s.id, top: r.top + window.scrollY, h: r.height });
    });
    return { list: out, max: document.documentElement.scrollHeight - innerHeight, vh: innerHeight };
  });
  const plan = [];
  marks.list.forEach((m) => {
    if (m.id === 'despegue') return;
    const pinned = m.h > marks.vh * 1.6;
    const fr = pinned ? [0.02, 0.35, 0.7, 0.98] : [0];
    fr.forEach((f, i) => plan.push({ name: `${m.id}-${i}`, y: Math.min(marks.max, m.top + (pinned ? (m.h - marks.vh) * f : 0)) }));
    if (!pinned && m.h > marks.vh * 1.1) plan.push({ name: `${m.id}-b`, y: Math.min(marks.max, m.top + m.h - marks.vh) });
  });
  plan.push({ name: 'zz-final', y: marks.max });
  let n = 1;
  for (const p of plan) {
    // Pasos intermedios para que los scrub y los disparadores «once» se activen como al bajar de verdad
    const from = await page.evaluate(() => window.scrollY);
    const steps = Math.max(1, Math.min(12, Math.round(Math.abs(p.y - from) / (marks.vh * 0.8))));
    for (let s = 1; s <= steps; s++) {
      await page.evaluate((y) => window.scrollTo(0, y), from + ((p.y - from) * s) / steps);
      await sleep(70);
    }
    await sleep(2200);
    await page.screenshot({ path: path.join(outDir, `${pre}-${String(n++).padStart(2, '0')}-${p.name}.png`) });
  }
  console.log(pre, 'capturas:', n, '· avisos/errores:', logs.length);
  logs.slice(0, 30).forEach((l) => console.log('  ', l));
  await browser.close();
  server.close();
})();
