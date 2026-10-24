// Construye la web publicada a partir de fuente/src:
//   index.html           → versión en español (raíz del sitio)
//   en/index.html        → versión en inglés (textos del HTML traducidos con src/i18n/en.json)
//   assets/web/app.js    → todo el JavaScript (minificado)
//   assets/web/styles.css→ estilos y fuentes (minificado)
//   sitemap.xml          → las dos versiones con sus alternativas de idioma
// Con --vista-previa además genera fuente/out/vista-previa-es.html y -en.html: archivos únicos que se abren
// con doble clic (llevan dentro librerías y fuentes) para revisar la web sin publicarla.
import { build, transform } from 'esbuild';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fuente = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.resolve(fuente, '..');
const rd = (p) => fs.readFileSync(path.join(fuente, p), 'utf8');
const wr = (p, s) => { fs.mkdirSync(path.dirname(path.join(site, p)), { recursive: true }); fs.writeFileSync(path.join(site, p), s); };
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
const PREVIEW = process.argv.includes('--vista-previa');

const ORIGIN = 'https://www.interemprex.com';
const VENDOR = ['gsap.min.js', 'ScrollTrigger.min.js', 'lenis.min.js'];
const FONTS = [
  ['Space Grotesk', '300 700', 'grotesk-latin.woff2'],
  ['Inter', '100 900', 'inter-latin.woff2'],
  ['JetBrains Mono', '100 800', 'jbmono-latin.woff2'],
];
const PRELOAD = ['grotesk-latin.woff2', 'inter-latin.woff2'];

// Textos de la cabecera y del cambio de idioma de cada versión
const LANGS = {
  es: {
    path: '',
    url: ORIGIN + '/',
    locale: 'es_ES',
    title: 'INTEREMPREX — Digitalizamos, automatizamos y escalamos negocios',
    desc: 'INTEREMPREX — Digitalizamos, automatizamos y escalamos operaciones de comercio internacional. Web, automatización, marketing digital e internacionalización.',
    ogTitle: 'INTEREMPREX — Lanza tu negocio',
    ogDesc: 'Del caos operativo al sistema que escala. Digitalizamos, automatizamos y escalamos negocios de comercio internacional.',
    org: 'Partner operativo de comercio internacional. Digitalizamos, automatizamos y escalamos negocios físicos.',
    tokens: { altHref: 'en/', altLang: 'en', altTitle: 'English version', altCode: 'EN', altName: 'English', legalNote: '' },
  },
  en: {
    path: 'en/',
    url: ORIGIN + '/en/',
    locale: 'en_GB',
    title: 'INTEREMPREX — We digitalize, automate and scale businesses',
    desc: 'INTEREMPREX — We digitalize, automate and scale international trade operations. Web, automation, digital marketing and internationalization.',
    ogTitle: 'INTEREMPREX — Launch your business',
    ogDesc: 'From operational chaos to a system that scales. We digitalize, automate and scale international trade businesses.',
    org: 'Operations partner for international trade. We digitalize, automate and scale physical businesses.',
    tokens: { altHref: '../', altLang: 'es', altTitle: 'Versión en español', altCode: 'ES', altName: 'Español', legalNote: '<p class="legal-lang mono">These legal texts are published in Spanish.</p>' },
  },
};

// ---------- Traducción del HTML ----------
// Diccionario exacto { "texto tal cual está en body.html": "English" }. Se traducen los nodos de texto y los
// atributos que se leen o se oyen; lo que va entre <!-- i18n:skip --> y <!-- /i18n:skip --> se queda igual.
// Si falta alguna traducción, la construcción se para y dice cuáles.
const ATTRS = ['aria-label', 'title', 'placeholder', 'alt', 'data-text', 'data-chapter', 'aria-valuetext'];
const hasLetters = (t) => /\p{L}/u.test(t.replace(/&#?\w+;/g, '')) && !/^\{\{\w+\}\}$/.test(t);
function translate(html, dict) {
  const missing = new Set();
  const used = new Set();
  const tr = (raw) => {
    const t = raw.trim();
    if (!t || !hasLetters(t)) return raw;
    if (!Object.prototype.hasOwnProperty.call(dict, t)) { missing.add(t); return raw; }
    used.add(t);
    return raw.slice(0, raw.indexOf(t)) + dict[t] + raw.slice(raw.indexOf(t) + t.length);
  };
  const attrRe = new RegExp(`(\\s(?:${ATTRS.join('|')})=")([^"]*)(")`, 'g');
  const one = (chunk) => chunk.replace(/(<!--[\s\S]*?-->)|(<[^>]+>)|([^<]+)/g, (m, comment, tag, text) => {
    if (comment) return comment;
    if (tag) return tag.replace(attrRe, (mm, a, v, z) => a + tr(v) + z);
    return tr(text);
  });
  const parts = html.split(/(<!-- i18n:skip[\s\S]*?<!-- \/i18n:skip -->)/);
  const out = parts.map((p) => (p.startsWith('<!-- i18n:skip') ? p : one(p))).join('');
  const unused = Object.keys(dict).filter((k) => !used.has(k));
  return { out, missing: [...missing], unused };
}
const fill = (html, tokens) => html.replace(/\{\{(\w+)\}\}/g, (m, k) => {
  if (!(k in tokens)) throw new Error('Falta el valor de {{' + k + '}}');
  return tokens[k];
});
const stripComments = (html) => html.replace(/<!--[\s\S]*?-->\n?/g, '');

// ---------- JavaScript y estilos ----------
const js = (await build({
  entryPoints: [path.join(fuente, 'src/js/main.js')],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  minify: true,
  legalComments: 'none',
  write: false,
})).outputFiles[0].text;
const face = (fam, w, src) => `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;src:url(${src}) format('woff2');}`;
const cssSrc = (fontUrl) => `[hidden]{display:none!important}\n${FONTS.map(([fam, w, f]) => face(fam, w, fontUrl(f))).join('\n')}\n${rd('src/lenis.css')}\n${rd('src/styles.css')}`;
const css = (await transform(cssSrc((f) => 'fonts/' + f), { loader: 'css', minify: true })).code;
const jsV = hash(js);
const cssV = hash(css);
wr('assets/web/app.js', js);
wr('assets/web/styles.css', css);

// ---------- Páginas ----------
const body = rd('src/body.html');
const dict = JSON.parse(rd('src/i18n/en.json'));
const enBody = translate(body, dict);
if (enBody.missing.length) {
  console.error('Faltan ' + enBody.missing.length + ' traducciones en src/i18n/en.json:\n' + enBody.missing.map((t) => '  ' + JSON.stringify(t)).join('\n'));
  process.exit(1);
}
if (enBody.unused.length) console.warn('Traducciones que ya no se usan (se pueden borrar):\n' + enBody.unused.map((t) => '  ' + JSON.stringify(t)).join('\n'));

// Enciende la precarga antes del primer pintado (mismo criterio que main.js: sin «reducir movimiento» y sin ancla)
const bootJs = "(function(d){var p=null;try{p=localStorage.getItem('ix-motion')}catch(e){}var r=new URLSearchParams(location.search).has('reducido')||(p?p==='reduced':matchMedia('(prefers-reduced-motion: reduce)').matches);if(!r&&location.hash.length<2)d.classList.add('is-loading')})(document.documentElement)";

const jsonLd = (L) => JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'INTEREMPREX',
  url: ORIGIN + '/',
  logo: ORIGIN + '/assets/favicon-512.png',
  description: L.org,
  email: 'Interemprex@gmail.com',
  telephone: '+34656718916',
  address: { '@type': 'PostalAddress', addressRegion: 'Extremadura', addressCountry: 'ES' },
  sameAs: ['https://www.linkedin.com/company/interemprex', 'https://www.instagram.com/interemprex', 'https://twitter.com/interemprex'],
}, null, 2);

const page = (lang, { styles, scripts, p }) => {
  const L = LANGS[lang];
  const other = LANGS[lang === 'es' ? 'en' : 'es'];
  const html = lang === 'es' ? body : enBody.out;
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${L.title}</title>
<meta name="description" content="${L.desc}">
<meta name="theme-color" content="#04070f">
<link rel="canonical" href="${L.url}">
<link rel="alternate" hreflang="es" href="${LANGS.es.url}">
<link rel="alternate" hreflang="en" href="${LANGS.en.url}">
<link rel="alternate" hreflang="x-default" href="${LANGS.es.url}">
<link rel="icon" type="image/png" sizes="32x32" href="${p}assets/favicon-32.png">
<link rel="icon" type="image/png" sizes="192x192" href="${p}assets/favicon-192.png">
<link rel="icon" type="image/png" sizes="512x512" href="${p}assets/favicon-512.png">
<link rel="apple-touch-icon" sizes="180x180" href="${p}assets/apple-touch-icon.png">
<link rel="shortcut icon" href="${p}assets/favicon.ico">
<meta property="og:type" content="website">
<meta property="og:site_name" content="INTEREMPREX">
<meta property="og:locale" content="${L.locale}">
<meta property="og:locale:alternate" content="${other.locale}">
<meta property="og:title" content="${L.ogTitle}">
<meta property="og:description" content="${L.ogDesc}">
<meta property="og:url" content="${L.url}">
<meta property="og:image" content="${ORIGIN}/assets/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${L.ogTitle}">
<meta name="twitter:description" content="${L.ogDesc}">
<meta name="twitter:image" content="${ORIGIN}/assets/og-image.jpg">
<script type="application/ld+json">
${jsonLd(L)}
</script>
<!-- Plausible / GA4: descomenta al publicar
<script defer data-domain="interemprex.com" src="https://plausible.io/js/script.js"></script>
-->
${styles}
<script>${bootJs}</script>
</head>
<body>
${stripComments(fill(html, L.tokens))}
${scripts}
</body>
</html>
`;
};

for (const lang of Object.keys(LANGS)) {
  const p = lang === 'es' ? '' : '../';
  const styles = [
    ...PRELOAD.map((f) => `<link rel="preload" href="${p}assets/web/fonts/${f}" as="font" type="font/woff2" crossorigin>`),
    `<link rel="stylesheet" href="${p}assets/web/styles.css?v=${cssV}">`,
  ].join('\n');
  const scripts = [...VENDOR.map((v) => `<script src="${p}assets/web/vendor/${v}"></script>`), `<script src="${p}assets/web/app.js?v=${jsV}"></script>`].join('\n');
  wr(LANGS[lang].path + 'index.html', page(lang, { styles, scripts, p }));
}

// ---------- Sitemap ----------
const today = new Date().toISOString().slice(0, 10);
const alt = Object.entries(LANGS).map(([l, L]) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${L.url}"/>`).join('\n') + `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${LANGS.es.url}"/>`;
wr('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${Object.entries(LANGS).map(([l, L]) => `  <url>
    <loc>${L.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${l === 'es' ? '1.0' : '0.8'}</priority>
${alt}
  </url>`).join('\n')}
</urlset>
`);

// ---------- Vista previa en un solo archivo (no se publica) ----------
if (PREVIEW) {
  const b64 = (f) => fs.readFileSync(path.join(site, f)).toString('base64');
  const esc = (s) => s.replace(/<\/script/gi, '<\\/script');
  const cssInline = (await transform(cssSrc((f) => 'data:font/woff2;base64,' + b64('assets/web/fonts/' + f)), { loader: 'css', minify: true })).code;
  const favicon = `data:image/png;base64,${b64('assets/favicon-32.png')}`;
  fs.mkdirSync(path.join(fuente, 'out'), { recursive: true });
  for (const lang of Object.keys(LANGS)) {
    const other = lang === 'es' ? 'en' : 'es';
    const html = page(lang, {
      p: '',
      styles: `<style>${cssInline}</style>`,
      scripts: [...VENDOR.map((v) => `<script>${esc(fs.readFileSync(path.join(site, 'assets/web/vendor', v), 'utf8'))}</script>`), `<script>${esc(js)}</script>`].join('\n'),
    })
      .replace(/href="assets\/(favicon|apple-touch-icon)[^"]*"/g, `href="${favicon}"`)
      .replaceAll(`href="${LANGS[lang].tokens.altHref}"`, `href="vista-previa-${other}.html"`);
    fs.writeFileSync(path.join(fuente, 'out', `vista-previa-${lang}.html`), html);
  }
}

const kb = (f) => (fs.statSync(path.join(site, f)).size / 1024).toFixed(0) + ' KB';
console.log('index.html', kb('index.html'), '· en/index.html', kb('en/index.html'), '· app.js', kb('assets/web/app.js'), '· styles.css', kb('assets/web/styles.css'), PREVIEW ? '· vista previa en fuente/out/' : '');
