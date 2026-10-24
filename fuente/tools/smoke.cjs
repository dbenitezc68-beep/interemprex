// Carga rápida de cada versión (es/en × ordenador/móvil/sin movimiento, y sin librerías) y cuenta errores.
// Uso: node fuente/tools/smoke.cjs [carpeta-capturas]
const path = require('path');
const fs = require('fs');
const { loadPlaywright, ARGS, serve, guard, sleep } = require('./lib.cjs');
const { chromium } = loadPlaywright();
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'out', 'smoke'));
fs.mkdirSync(out, { recursive: true });

const CASES = [];
for (const lang of ['es', 'en']) {
  CASES.push({ lang, kind: 'desktop' }, { lang, kind: 'mobile' }, { lang, kind: 'desktop', reduced: true });
}
CASES.push({ lang: 'es', kind: 'desktop', nolibs: true });

(async () => {
  const { server, url } = await serve();
  const browser = await chromium.launch({ args: ARGS });
  let bad = 0;
  for (const c of CASES) {
    const mobile = c.kind === 'mobile';
    const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, reducedMotion: c.reduced ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage();
    await guard(page);
    if (c.nolibs) await page.route(/vendor\/(gsap|ScrollTrigger|lenis)/, (r) => r.abort());
    const logs = [];
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) logs.push(`[${m.type()}] ${m.text()}`); });
    page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
    await page.goto(url + (c.lang === 'en' ? 'en/' : ''));
    await sleep(c.reduced || c.nolibs ? 1500 : 4200);
    const st = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      cls: document.documentElement.className,
      loading: document.documentElement.classList.contains('is-loading'),
      over: document.documentElement.scrollWidth - innerWidth,
      rail: (document.getElementById('railT') || {}).textContent,
      h1: document.querySelector('h1 .sr-only').textContent,
      fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family).filter((v, i, a) => a.indexOf(v) === i).length,
      lab: !!document.getElementById('laboratorio'),
      mech: !!document.getElementById('mechPanel'),
      demoTxt: /\bdemo\b|propuesta/i.test(document.body.innerText),
    }));
    const name = `${c.lang}-${c.kind}${c.reduced ? '-reducido' : ''}${c.nolibs ? '-sinlibrerias' : ''}`;
    await page.screenshot({ path: path.join(out, name + '.png') });
    const ok = !logs.length && st.over <= 0 && !st.loading && !st.lab && !st.mech && !st.demoTxt && st.lang === c.lang;
    if (!ok) bad++;
    console.log(`${ok ? 'OK ' : 'MAL'} · ${name} · ${st.cls} · carril ${st.rail} · «${st.h1}» · fuentes ${st.fonts} · lateral ${st.over}px${st.demoTxt ? ' · ¡texto de demo!' : ''}`);
    logs.slice(0, 8).forEach((l) => console.log('     ', l));
    await ctx.close();
  }
  await browser.close();
  server.close();
  process.exit(bad ? 1 : 0);
})();
