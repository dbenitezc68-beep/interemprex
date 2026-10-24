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

## Fluidez

Reglas que mantienen la web fluida (cada una se midió con `perf.cjs` y con las herramientas de rendimiento de Chrome):

- Lo que no se ve no trabaja: cada sección, cada parada del carril de servicios y el pie reciben la clase `.off` al salir de pantalla, y sus animaciones CSS en bucle quedan en pausa. Los lienzos (estrellas, globo, partículas) tampoco dibujan si no están a la vista o si nada ha cambiado.
- Animar solo `transform` y `opacity`. Nada de `top`, `width`, `clip-path` con variables ni pesos de fuente en bucle.
- No animar elementos SVG, tampoco el `<svg>` raíz: Chrome repinta la página entera en cada fotograma. Se envuelve el SVG en un `div` (o se dibuja la pieza móvil en HTML) y se anima eso.
- Sin `backdrop-filter`: fondos algo más opacos en su lugar.
- En los lienzos: colores precalculados y agrupados (nada de cadenas `rgba()` por punto) y trazados SVG muestreados una sola vez con `pathSampler` (`src/js/util.js`).
- Los suavizados que siguen al puntero dependen del tiempo, no de los fotogramas, para que un móvil lento no vaya a cámara lenta.
- Ningún bucle de fotogramas sin fin: cada `requestAnimationFrame` y cada oyente de `gsap.ticker` arranca y se para con `onVisible(…, ON_SCREEN)` (un margen de −2 px, para que lo que solo toca el borde no cuente como visible) y se suelta cuando no queda nada que cambiar. Así el reloj de GSAP se duerme en reposo (`autoSleep: 30`). En táctil (salvo Firefox) se corta además el bucle `_rafBugFix` de ScrollTrigger, que pide fotogramas sin hacer nada.
- En pantallas táctiles el scroll es el nativo: Lenis solo se usa con ratón o trackpad, porque sus oyentes táctiles retrasaban el arranque del scroll con el dedo (de 20–60 ms a 1 ms sin él). `getScroll()`/`getVelocity()` y `lock` (`src/js/main.js`) funcionan con y sin Lenis.
- Tamaños con `onResize` (ResizeObserver) y no con el evento `resize` de la ventana, que en el móvil salta cada vez que la barra de direcciones aparece o se esconde. Por lo mismo, el cielo de estrellas mide `100lvh` en táctil.
- No leer `scrollY` ni medidas de la página dentro de un bucle: obligan al navegador a recalcular la maqueta. Se guardan al hacer scroll o al cambiar de tamaño.
- Los titulares que se descifran fijan el ancho exacto de cada letra, sin redondear: con anchos redondeados una línea podía partirse distinto en el móvil y mover la página.
- Dentro de un recorte `clip-path` que usa una variable (el lado «sistema» del comparador), Chrome hacía trabajar al hilo principal en cada fotograma para animar la opacidad de los pasos, aunque la animación debía ir fuera de él. En táctil, el halo animado va en su propia capa (`translateZ(0)`). Para comprobar algo así: pausar las animaciones una a una (`document.getAnimations()`) y contar los fotogramas del hilo principal en una traza.

## Formulario

Envía a Web3Forms con la misma clave y los mismos campos que la web anterior (`name`, `company`, `email`, `service`, `message`), más `language` (ES/EN). El asunto es `[INTEREMPREX web] Nombre — Servicio` (o `[INTEREMPREX web · EN] …` desde la versión inglesa). El cohete solo despega cuando Web3Forms confirma el envío; si falla, se conservan los datos y se ofrecen el email y WhatsApp. Sin JavaScript, el formulario se envía igualmente de forma nativa.

## Pendiente

- X18 · Laboratorio de demos: se añadirá más adelante.
- Analítica: el fragmento de Plausible está comentado en `tools/build.mjs`; se activa quitando el comentario y reconstruyendo.
