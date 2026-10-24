// Mide los fotogramas al recorrer cada sección con la rueda: node fuente/tools/perf.cjs [es|en] [secciones]
// En este entorno el navegador dibuja sin tarjeta gráfica: sirve para comparar secciones entre sí, no como cifra absoluta.
const { loadPlaywright, ARGS, serve, guard, sleep } = require('./lib.cjs');
const { chromium } = loadPlaywright();
const lang = process.argv[2] === 'en' ? 'en' : 'es';
const ids = (process.argv[3] || 'despegue,telemetria,manifiesto,por-que,servicios,resultados,escaner,proceso,comparador,mision,dudas,contacto,base').split(',');

(async () => {
  const { server, url } = await serve();
  const browser = await chromium.launch({ args: ARGS });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await guard(page);
  await page.goto(url + (lang === 'en' ? 'en/' : ''));
  await sleep(4500);
  await page.mouse.move(700, 450);
  for (const id of ids) {
    const y = await page.evaluate((s) => document.getElementById(s).getBoundingClientRect().top + scrollY, id);
    const from = await page.evaluate(() => scrollY);
    const steps = Math.max(1, Math.min(16, Math.round(Math.abs(y - from) / 700)));
    for (let s = 1; s <= steps; s++) { await page.evaluate((v) => scrollTo(0, v), from + ((y - from) * s) / steps); await sleep(50); }
    await sleep(1500);
    await page.evaluate(() => {
      window.__f = [];
      let last = performance.now();
      const loop = (t) => { window.__f.push(t - last); last = t; if (window.__run) requestAnimationFrame(loop); };
      window.__run = true;
      requestAnimationFrame(loop);
    });
    const n = id === 'servicios' ? 70 : 24;
    for (let i = 0; i < n; i++) { await page.mouse.wheel(0, 90); await sleep(100); }
    await sleep(400);
    const r = await page.evaluate(() => {
      window.__run = false;
      const f = window.__f.slice(2).sort((a, b) => a - b);
      const avg = f.reduce((a, b) => a + b, 0) / f.length;
      return { frames: f.length, media: +avg.toFixed(1), p95: +f[Math.floor(f.length * 0.95)].toFixed(1), max: +f[f.length - 1].toFixed(1) };
    });
    console.log(id.padEnd(12), JSON.stringify(r));
  }
  await browser.close();
  server.close();
})();
