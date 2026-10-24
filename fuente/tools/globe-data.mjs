// Genera src/js/globe-data.js: puntos de tierra del mundo (Natural Earth 1:110m vía world-atlas)
// en una rejilla de igual área, codificados como pares Int16 (lat·100, lon·100) en base64.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const topo = require('world-atlas/land-110m.json');
const land = feature(topo, topo.objects.land);

const polys = [];
land.features.forEach((f) => {
  const g = f.geometry;
  if (g.type === 'Polygon') polys.push(g.coordinates);
  else if (g.type === 'MultiPolygon') g.coordinates.forEach((p) => polys.push(p));
});
const inRing = (x, y, ring) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const isLand = (lon, lat) => polys.some((p) => inRing(lon, lat, p[0]) && !p.slice(1).some((h) => inRing(lon, lat, h)));

const STEP = Number(process.argv[2] || 2);
const pts = [];
for (let lat = -56; lat <= 80; lat += STEP) {
  const n = Math.max(1, Math.round((360 * Math.cos((lat * Math.PI) / 180)) / STEP));
  for (let k = 0; k < n; k++) {
    const lon = -180 + (k + (Math.abs(Math.round(lat / STEP)) % 2) * 0.5) * (360 / n);
    if (isLand(lon, lat)) pts.push(Math.round(lat * 100), Math.round(lon * 100));
  }
}
const buf = Buffer.from(new Int16Array(pts).buffer);
const out = `// Generado por tools/globe-data.mjs a partir de world-atlas (Natural Earth, dominio público).\n// ${pts.length / 2} puntos de tierra, pares Int16 (lat·100, lon·100) en base64.\nexport const LAND = '${buf.toString('base64')}';\n`;
fs.writeFileSync(path.join(root, 'src/js/globe-data.js'), out);
console.log('puntos', pts.length / 2, 'bytes', out.length);
