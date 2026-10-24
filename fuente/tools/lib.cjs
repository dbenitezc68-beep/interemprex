// Utilidades comunes de las pruebas: servidor local de la web, navegador y envío del formulario simulado.
const http = require('http');
const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '..', '..');
const loadPlaywright = () => {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(p); } catch (e) { /* se prueba la siguiente */ }
  }
  throw new Error('Playwright no está instalado (npm install -g playwright)');
};
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain', '.pdf': 'application/pdf', '.mp4': 'video/mp4' };

// Sirve la carpeta del sitio como lo haría Vercel (/ → index.html, /en/ → en/index.html)
function serve(port = 0) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      let file = path.join(SITE, p);
      if (!file.startsWith(SITE)) { res.writeHead(403); res.end(); return; }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!fs.existsSync(file)) { res.writeHead(404); res.end('404'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(port, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` }));
  });
}

// Corta todo lo que salga del ordenador y simula Web3Forms: nunca se envía un email de verdad en las pruebas
async function guard(page, state = { mode: 'ok', sent: [] }) {
  await page.route('**/*', async (route) => {
    const u = route.request().url();
    if (u.startsWith('http://127.0.0.1') || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    if (u.startsWith('https://api.web3forms.com/')) {
      const body = route.request().postDataBuffer();
      state.sent.push({ url: u, method: route.request().method(), body: body ? body.toString('utf8') : '' });
      if (state.mode === 'offline') return route.abort('internetdisconnected');
      await new Promise((r) => setTimeout(r, 350));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.mode === 'ok' ? { success: true, message: 'Email sent successfully!' } : { success: false, message: 'Something went wrong' }) });
    }
    return route.abort('blockedbyclient');
  });
  return state;
}

// Campos de un multipart/form-data (para comprobar qué se enviaría)
function fields(body) {
  const out = {};
  const re = /name="([^"]+)"\r\n\r\n([\s\S]*?)\r\n--/g;
  let m;
  while ((m = re.exec(body))) out[m[1]] = m[2];
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
module.exports = { SITE, loadPlaywright, ARGS, serve, guard, fields, sleep };
