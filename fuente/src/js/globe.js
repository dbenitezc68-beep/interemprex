import { $, clamp, lerp, onVisible } from './util.js';
import { LAND } from './globe-data.js';

const RAD = Math.PI / 180;
const HOME = [39.2, -6.2];
// Rutas de ejemplo, sin nombres: solo ilustran pedidos y proveedores fuera de España
const DEST = [[51.9, 4.5], [40.7, -74], [31.2, 121.5], [-23.5, -46.6], [33.6, -7.6], [25.2, 55.3], [52.5, 13.4], [19.4, -99.1]];

const vec = ([lat, lon]) => [Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD), Math.cos(lat * RAD) * Math.cos(lon * RAD)];

// X12 · Globo de puntos: tierra en puntos, Extremadura encendida y rutas que salen de ella; se gira arrastrando
export function initGlobe({ motion }) {
  const box = $('#globe');
  const canvas = $('#globeCanvas');
  const ctx = canvas.getContext('2d');
  const raw = atob(LAND);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const ints = new Int16Array(bytes.buffer);
  const pts = [];
  for (let i = 0; i < ints.length; i += 2) pts.push(vec([ints[i] / 100, ints[i + 1] / 100]));
  const home = vec(HOME);
  const routes = DEST.map((d, i) => {
    const b = vec(d);
    const dot = clamp(home[0] * b[0] + home[1] * b[1] + home[2] * b[2], -1, 1);
    const om = Math.acos(dot);
    const so = Math.sin(om) || 1;
    const path = [];
    for (let k = 0; k <= 48; k++) {
      const t = k / 48;
      const a = Math.sin((1 - t) * om) / so;
      const c = Math.sin(t * om) / so;
      const h = 1 + Math.sin(Math.PI * t) * (0.06 + om * 0.09);
      path.push([(home[0] * a + b[0] * c) * h, (home[1] * a + b[1] * c) * h, (home[2] * a + b[2] * c) * h]);
    }
    return { path, end: b, off: i / DEST.length };
  });

  let W = 0, H = 0, dpr = 1;
  const st = { lon: 4, lat: 26, vl: 0, dragging: false, x: 0, y: 0, t: 0 };
  const resize = () => {
    dpr = Math.min(1.75, window.devicePixelRatio || 1);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  };
  // giro: primero longitud (eje Y), luego inclinación (eje X)
  const rot = (v) => {
    const cl = Math.cos(st.lon * RAD), sl = Math.sin(st.lon * RAD);
    const x = v[0] * cl - v[2] * sl;
    const z0 = v[0] * sl + v[2] * cl;
    const ct = Math.cos(st.lat * RAD), stt = Math.sin(st.lat * RAD);
    const y = v[1] * ct - z0 * stt;
    const z = v[1] * stt + z0 * ct;
    return [x, y, z];
  };
  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const R = Math.min(W, H) * 0.42;
    const cx = W / 2;
    const cy = H * 0.47;
    // esfera y atmósfera
    const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
    g.addColorStop(0, '#0d2340');
    g.addColorStop(1, '#050b18');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    const rim = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.14);
    rim.addColorStop(0, 'rgba(45,212,191,0)');
    rim.addColorStop(0.45, 'rgba(45,212,191,0.22)');
    rim.addColorStop(1, 'rgba(45,212,191,0)');
    ctx.fillStyle = rim;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.14, 0, Math.PI * 2); ctx.fill();
    // tierra en puntos
    for (let i = 0; i < pts.length; i++) {
      const [x, y, z] = rot(pts[i]);
      if (z <= 0) continue;
      const s = 0.9 + z * 1.3;
      ctx.fillStyle = `rgba(150,220,235,${(0.18 + z * 0.62).toFixed(2)})`;
      ctx.fillRect(cx + x * R - s / 2, cy - y * R - s / 2, s, s);
    }
    // rutas
    routes.forEach((r) => {
      const prog = (st.t * 0.22 + r.off) % 1;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      let pen = false;
      r.path.forEach((v) => {
        const [x, y, z] = rot(v);
        if (z < -0.05) { pen = false; return; }
        const px = cx + x * R, py = cy - y * R;
        if (pen) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        pen = true;
      });
      ctx.strokeStyle = 'rgba(56,189,248,0.28)';
      ctx.stroke();
      // cometa
      const head = Math.floor(prog * (r.path.length - 1));
      for (let k = Math.max(0, head - 10); k <= head; k++) {
        const [x, y, z] = rot(r.path[k]);
        if (z < -0.05) continue;
        const a = (1 - (head - k) / 11) * 0.95;
        ctx.fillStyle = `rgba(125,240,225,${a.toFixed(2)})`;
        ctx.beginPath(); ctx.arc(cx + x * R, cy - y * R, 1.2 + a * 1.6, 0, Math.PI * 2); ctx.fill();
      }
      const [ex, ey, ez] = rot(r.end);
      if (ez > 0) {
        ctx.fillStyle = 'rgba(56,189,248,0.9)';
        ctx.beginPath(); ctx.arc(cx + ex * R, cy - ey * R, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    });
    // Extremadura
    const [hx, hy, hz] = rot(home);
    if (hz > 0) {
      const pulse = (st.t * 0.8) % 1;
      ctx.strokeStyle = `rgba(45,212,191,${(1 - pulse).toFixed(2)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx + hx * R, cy - hy * R, 4 + pulse * 16, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(cx + hx * R, cy - hy * R, 3.6, 0, Math.PI * 2); ctx.fill();
    }
  };

  resize();
  window.addEventListener('resize', () => { resize(); if (!motion) draw(); });
  // Arrastrar para girar (en táctil solo el gesto horizontal; el vertical sigue siendo scroll)
  canvas.addEventListener('pointerdown', (e) => {
    st.dragging = true;
    st.x = e.clientX;
    st.y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!st.dragging) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    st.x = e.clientX;
    st.y = e.clientY;
    st.lon += dx * 0.35;
    st.vl = dx * 0.35;
    if (e.pointerType === 'mouse') st.lat = clamp(st.lat + dy * 0.25, -20, 60);
    if (!motion) draw();
  });
  const up = () => { st.dragging = false; };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  if (!motion) { st.t = 0.3; draw(); return; }
  let visible = false;
  onVisible(box, (v) => { visible = v; });
  let last = performance.now();
  const tick = (now) => {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible) return;
    st.t += dt;
    if (!st.dragging) {
      st.vl = lerp(st.vl, 0, 0.05);
      st.lon += st.vl + dt * 9;
    }
    if (canvas.clientWidth !== W) resize();
    draw();
  };
  requestAnimationFrame(tick);
}
