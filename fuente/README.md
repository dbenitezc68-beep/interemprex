# Web de INTEREMPREX · código fuente

La web publicada son archivos estáticos en la raíz del repositorio (Vercel los sirve tal cual, sin paso de compilación):

| Archivo | Qué es |
| --- | --- |
| `index.html` | Versión en español (`/`) |
| `en/index.html` | Versión en inglés (`/en/`) |
| `assets/web/app.js` | Todo el JavaScript, minificado |
| `assets/web/styles.css` | Estilos y fuentes, minificado |
| `assets/web/vendor/` | GSAP 3.13, ScrollTrigger y Lenis 1.3 (alojados aquí, sin CDN) |
| `assets/web/fonts/` | Space Grotesk, Inter y JetBrains Mono (woff2, alojadas aquí) |
| `sitemap.xml` | Las dos versiones con sus alternativas de idioma |

Esos archivos **se generan** desde esta carpeta. No se editan a mano: se edita `fuente/src` y se vuelve a construir.

## Estructura

- `src/body.html`: todo el contenido de la página, en español. Las secciones van marcadas con su código (X01…X27).
- `src/i18n/en.json`: traducción al inglés de cada texto del HTML (texto exacto en español → inglés). Si se cambia o se añade un texto en `body.html`, la construcción avisa de lo que falta por traducir y se detiene.
- `src/js/i18n.js`: textos que escribe el JavaScript (buscador, misión, consola de dudas, formulario…), en los dos idiomas.
- `src/js/*.js`: una pieza por mecánica (`hero.js`, `services.js`, `contact.js`, `legal.js`…). `main.js` las arranca.
- `src/styles.css`: estilos.
- Los textos legales (privacidad, cookies, aviso legal y condiciones) están al final de `body.html`, dentro de la ventana `#legal`. Se publican en español también en la versión inglesa, como en la web anterior.

## Construir

Requiere Node 18 o superior.

```bash
cd fuente/tools
npm install          # solo la primera vez
node build.mjs       # regenera index.html, en/index.html, assets/web y sitemap.xml
node build.mjs --vista-previa   # además crea fuente/out/vista-previa-es.html y -en.html
```

Las vistas previas son archivos únicos que se abren con doble clic, sin servidor. Ojo: su formulario **envía de verdad** a Web3Forms.

## Probar

Las pruebas usan Playwright con Chromium (si no está instalado: `npm install --no-save playwright && npx playwright install chromium` dentro de `fuente/tools`). Levantan un servidor local y **cortan todo lo que salga del ordenador**: el envío del formulario a Web3Forms se simula, así que nunca llega un email de prueba.

```bash
cd fuente/tools
node smoke.cjs                    # carga cada versión (es/en, ordenador/móvil/sin movimiento/sin librerías)
node interact.cjs es              # todas las interacciones en ordenador (también en: en)
node interact-mobile.cjs es       # interacciones táctiles en móvil (también en: en)
node shoot.cjs ../out/capturas en mobile      # capturas sección a sección
node perf.cjs es                  # fotogramas al recorrer cada sección
```

`npm test` ejecuta la carga rápida y las pruebas de interacción en los dos idiomas. Los resultados y capturas quedan en `fuente/out/` (no se sube al repositorio).

## Formulario

Envía a Web3Forms con la misma clave y los mismos campos que la web anterior (`name`, `company`, `email`, `service`, `message`), más `language` (ES/EN). El asunto es `[INTEREMPREX web] Nombre — Servicio` (o `[INTEREMPREX web · EN] …` desde la versión inglesa). El cohete solo despega cuando Web3Forms confirma el envío; si falla, se conservan los datos y se ofrecen el email y WhatsApp. Sin JavaScript, el formulario se envía igualmente de forma nativa.

## Pendiente

- X18 · Laboratorio de demos: se añadirá más adelante.
- Analítica: el fragmento de Plausible está comentado en `tools/build.mjs`; se activa quitando el comentario y reconstruyendo.
