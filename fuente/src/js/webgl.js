// Motor WebGL2 mínimo para la órbita de INTEREMPREX: paneles del logotipo, planetas, halos y órbitas,
// con una luz de espacio (luz fría principal y contraluz violeta). Sin librerías 3D.

export const M4 = {
  ident() {
    const m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
  },
  mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        o[c * 4 + r] = s;
      }
    }
    return o;
  },
  chain(...ms) { return ms.reduce((acc, m) => M4.mul(acc, m)); },
  persp(fovy, aspect, n, f) {
    const t = 1 / Math.tan(fovy / 2);
    const m = new Float32Array(16);
    m[0] = t / aspect;
    m[5] = t;
    m[10] = (f + n) / (n - f);
    m[11] = -1;
    m[14] = (2 * f * n) / (n - f);
    return m;
  },
  lookAt(e, c, up = [0, 1, 0]) {
    let z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]];
    let l = Math.hypot(z[0], z[1], z[2]) || 1;
    z = [z[0] / l, z[1] / l, z[2] / l];
    let x = [up[1] * z[2] - up[2] * z[1], up[2] * z[0] - up[0] * z[2], up[0] * z[1] - up[1] * z[0]];
    l = Math.hypot(x[0], x[1], x[2]) || 1;
    x = [x[0] / l, x[1] / l, x[2] / l];
    const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    const m = new Float32Array(16);
    m[0] = x[0]; m[1] = y[0]; m[2] = z[0];
    m[4] = x[1]; m[5] = y[1]; m[6] = z[1];
    m[8] = x[2]; m[9] = y[2]; m[10] = z[2];
    m[12] = -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]);
    m[13] = -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]);
    m[14] = -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]);
    m[15] = 1;
    return m;
  },
  translate(x, y, z) { const m = M4.ident(); m[12] = x; m[13] = y; m[14] = z; return m; },
  scale(x, y, z) { const m = M4.ident(); m[0] = x; m[5] = y; m[10] = z; return m; },
  rotX(a) { const c = Math.cos(a), s = Math.sin(a), m = M4.ident(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; },
  rotY(a) { const c = Math.cos(a), s = Math.sin(a), m = M4.ident(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; },
  rotZ(a) { const c = Math.cos(a), s = Math.sin(a), m = M4.ident(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; },
};

export function normalMatrix(m) {
  const a = m[0], b = m[4], c = m[8];
  const d = m[1], e = m[5], f = m[9];
  const g = m[2], h = m[6], i = m[10];
  const C00 = e * i - f * h, C01 = -(d * i - f * g), C02 = d * h - e * g;
  const C10 = -(b * i - c * h), C11 = a * i - c * g, C12 = -(a * h - b * g);
  const C20 = b * f - c * e, C21 = -(a * f - c * d), C22 = a * e - b * d;
  const det = a * C00 + b * C01 + c * C02 || 1;
  return new Float32Array([C00 / det, C10 / det, C20 / det, C01 / det, C11 / det, C21 / det, C02 / det, C12 / det, C22 / det]);
}

// Superficie de revolución alrededor del eje Y. Perfil: [[r, y, esquinaViva?], ...] de abajo arriba.
export function lathe(pts, seg = 64) {
  const n = pts.length;
  const segN = (i) => {
    const dr = pts[i + 1][0] - pts[i][0];
    const dy = pts[i + 1][1] - pts[i][1];
    const l = Math.hypot(dr, dy) || 1;
    return [dy / l, -dr / l];
  };
  const rings = [];
  for (let i = 0; i < n; i++) {
    const [r, y, sharp] = pts[i];
    const a = i > 0 ? segN(i - 1) : null;
    const b = i < n - 1 ? segN(i) : null;
    if (sharp && a && b) {
      rings.push([r, y, a[0], a[1]]);
      rings.push([r, y, b[0], b[1]]);
    } else {
      let nr = 0, ny = 0;
      if (a) { nr += a[0]; ny += a[1]; }
      if (b) { nr += b[0]; ny += b[1]; }
      const l = Math.hypot(nr, ny) || 1;
      rings.push([r, y, nr / l, ny / l]);
    }
  }
  const R = rings.length;
  const cols = seg + 1;
  const pos = new Float32Array(R * cols * 3);
  const nor = new Float32Array(R * cols * 3);
  const uv = new Float32Array(R * cols * 2);
  for (let i = 0; i < R; i++) {
    const [r, y, nr, ny] = rings[i];
    for (let j = 0; j <= seg; j++) {
      const ang = (j / seg) * Math.PI * 2;
      const c = Math.cos(ang), s = Math.sin(ang);
      const k = i * cols + j;
      pos[k * 3] = r * c; pos[k * 3 + 1] = y; pos[k * 3 + 2] = r * s;
      nor[k * 3] = nr * c; nor[k * 3 + 1] = ny; nor[k * 3 + 2] = nr * s;
      uv[k * 2] = j / seg; uv[k * 2 + 1] = i / (R - 1);
    }
  }
  const idx = [];
  for (let i = 0; i < R - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * cols + j, b = a + cols;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return { pos, nor, uv, idx };
}

export function torus(R, r, segU = 64, segV = 20) {
  const cols = segV + 1;
  const pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i <= segU; i++) {
    const u = (i / segU) * Math.PI * 2;
    const cu = Math.cos(u), su = Math.sin(u);
    for (let j = 0; j <= segV; j++) {
      const v = (j / segV) * Math.PI * 2;
      const cv = Math.cos(v), sv = Math.sin(v);
      pos.push((R + r * cv) * cu, (R + r * cv) * su, r * sv);
      nor.push(cv * cu, cv * su, sv);
      uv.push(i / segU, j / segV);
    }
  }
  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * cols + j, b = a + cols;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), uv: new Float32Array(uv), idx };
}

// Caja con normales por cara (24 vértices).
export function box(w, h, d) {
  const x = w / 2, y = h / 2, z = d / 2;
  const faces = [
    [[0, 0, 1], [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]]],
    [[0, 0, -1], [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]]],
    [[1, 0, 0], [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]]],
    [[-1, 0, 0], [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]]],
    [[0, 1, 0], [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]]],
    [[0, -1, 0], [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]]],
  ];
  const pos = [], nor = [], uv = [], idx = [];
  faces.forEach(([n, vs], f) => {
    vs.forEach((v) => { pos.push(...v); nor.push(...n); });
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    const b = f * 4;
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), uv: new Float32Array(uv), idx };
}

export function sphere(r = 1, seg = 32) {
  const pts = [];
  const n = Math.max(8, Math.round(seg / 2));
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return lathe(pts, seg);
}

// Circunferencia de radio 1 en el plano XZ, para dibujar órbitas con LINE_LOOP.
export function circle(seg = 160) {
  const pos = new Float32Array(seg * 3);
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pos[i * 3] = Math.cos(a);
    pos[i * 3 + 2] = Math.sin(a);
  }
  return pos;
}

const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNor;
layout(location=2) in vec2 aUv;
uniform mat4 uModel;
uniform mat4 uVP;
uniform mat3 uNM;
out vec3 vPos;
out vec3 vNor;
out vec3 vObj;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vPos = w.xyz;
  vNor = uNM * aNor;
  vObj = aPos;
  gl_Position = uVP * w;
}`;

const FS = `#version 300 es
precision highp float;
in vec3 vPos;
in vec3 vNor;
in vec3 vObj;
uniform vec3 uCam;
uniform vec3 uColor;
uniform vec3 uEmit;
uniform float uRough;
uniform float uMetal;
uniform float uAlpha;
uniform float uEnv;
uniform float uEnvRot;
out vec4 outColor;

// Entorno de espacio: luz fría principal, contraluz violeta y resplandor del horizonte
vec3 space(vec3 r, float rough) {
  float cr = cos(uEnvRot), sr = sin(uEnvRot);
  r = vec3(cr * r.x + sr * r.z, r.y, -sr * r.x + cr * r.z);
  float w = mix(0.02, 0.5, rough);
  vec3 col = vec3(0.004, 0.008, 0.018);
  vec3 k1 = normalize(vec3(0.62, 0.5, 0.62));
  col += vec3(0.62, 0.86, 1.0) * smoothstep(0.9 - w, 0.996, dot(r, k1)) * 3.2;
  vec3 k2 = normalize(vec3(-0.82, 0.22, -0.45));
  col += vec3(0.68, 0.56, 1.0) * smoothstep(0.9 - w, 0.996, dot(r, k2)) * 2.0;
  vec3 k3 = normalize(vec3(-0.3, 0.9, 0.3));
  col += vec3(0.75, 0.9, 1.0) * smoothstep(0.75 - w, 1.0, dot(r, k3)) * 0.55;
  col += vec3(0.08, 0.42, 0.75) * exp(-abs(r.y + 0.3) * 6.0) * 0.4;
  return col * uEnv;
}

void main() {
  vec3 N = normalize(vNor);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uCam - vPos);
  float rough = uRough;
  vec3 base = uColor;
  vec3 R = reflect(-V, N);
  float NdV = clamp(dot(N, V), 0.0, 1.0);
  vec3 F0 = mix(vec3(0.04), base, uMetal);
  vec3 F = F0 + (max(vec3(1.0 - rough), F0) - F0) * pow(1.0 - NdV, 5.0);
  vec3 spec = space(R, rough) * F;
  vec3 L = normalize(vec3(0.5, 0.75, 0.65));
  float wrapL = max((dot(N, L) + 0.3) / 1.3, 0.0);
  float hemi = 0.5 + 0.5 * N.y;
  vec3 diff = base * (wrapL * vec3(0.85, 0.93, 1.0) + hemi * vec3(0.1, 0.16, 0.3) + 0.02) * (1.0 - uMetal);
  vec3 rim = vec3(0.45, 0.7, 1.0) * pow(1.0 - NdV, 3.0) * 0.35 * (1.0 - rough * 0.4);
  vec3 col = diff + spec + rim + uEmit;
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
  outColor = vec4(col * uAlpha, uAlpha);
}`;

// Halo: cuadrado orientado a cámara con caída radial (color premultiplicado)
const GVS = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uVP;
uniform vec3 uC;
uniform float uS;
uniform vec2 uP;
out vec2 vQ;
void main() {
  vQ = aPos.xz;
  vec4 c = uVP * vec4(uC, 1.0);
  c.xy += aPos.xz * uS * uP;
  gl_Position = c;
}`;

const GFS = `#version 300 es
precision highp float;
in vec2 vQ;
uniform vec3 uCol;
uniform float uA;
out vec4 o;
void main() {
  float d = length(vQ);
  float a = exp(-d * d * 5.0) * (1.0 - smoothstep(0.75, 1.0, d)) * uA;
  o = vec4(uCol * a, a);
}`;

// Órbitas: líneas que se apagan en la mitad trasera
const LVS = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uModel;
uniform mat4 uVP;
uniform vec3 uCam;
out float vFront;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vec3 c = (uModel * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 toCam = normalize(uCam - c);
  float rad = length((uModel * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
  vFront = clamp(dot(w.xyz - c, toCam) / max(rad, 0.001), -1.0, 1.0);
  gl_Position = uVP * w;
}`;

const LFS = `#version 300 es
precision highp float;
in float vFront;
uniform vec4 uCol;
out vec4 o;
void main() {
  float a = uCol.a * mix(0.28, 1.0, vFront * 0.5 + 0.5);
  o = vec4(uCol.rgb * a, a);
}`;

const SVS = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uVP;
uniform vec3 uC;
uniform vec2 uR;
out vec2 vQ;
void main() {
  vQ = aPos.xz;
  gl_Position = uVP * vec4(uC.x + aPos.x * uR.x, uC.y, uC.z + aPos.z * uR.y, 1.0);
}`;

const SFS = `#version 300 es
precision highp float;
in vec2 vQ;
uniform float uS;
out vec4 o;
void main() {
  float d = length(vQ);
  float a = pow(clamp(1.0 - d, 0.0, 1.0), 2.0) * uS;
  o = vec4(0.0, 0.0, 0.0, a);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
  return s;
}
function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'program');
  return p;
}
function locs(gl, p, names) {
  const o = {};
  names.forEach((n) => { o[n] = gl.getUniformLocation(p, n); });
  return o;
}

export class GL {
  constructor(canvas, { dprMax = 2 } = {}) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 no disponible');
    this.gl = gl;
    this.canvas = canvas;
    this.dprMax = dprMax;
    this.p = program(gl, VS, FS);
    this.u = locs(gl, this.p, ['uModel', 'uVP', 'uNM', 'uCam', 'uColor', 'uEmit', 'uRough', 'uMetal', 'uAlpha', 'uEnv', 'uEnvRot']);
    this.sp = program(gl, SVS, SFS);
    this.su = locs(gl, this.sp, ['uVP', 'uC', 'uR', 'uS']);
    this.gp = program(gl, GVS, GFS);
    this.gu = locs(gl, this.gp, ['uVP', 'uC', 'uS', 'uP', 'uCol', 'uA']);
    this.lp = program(gl, LVS, LFS);
    this.lu = locs(gl, this.lp, ['uModel', 'uVP', 'uCam', 'uCol']);
    this.quad = this.mesh({
      pos: new Float32Array([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1]),
      nor: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
      uv: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      idx: [0, 1, 2, 0, 2, 3],
    });
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.envRot = 0;
    this.aspect = 1;
    // El tamaño del lienzo se guarda al cambiar (sin leer la maqueta en cada fotograma)
    this.box = null;
    if ('ResizeObserver' in window) {
      new ResizeObserver(([e]) => { this.box = { width: e.contentRect.width, height: e.contentRect.height }; }).observe(canvas);
    }
    this.resize();
  }
  resize() {
    const r = this.box || this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprMax);
    const w = Math.max(2, Math.round(r.width * dpr));
    const h = Math.max(2, Math.round(r.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
    this.aspect = w / h;
    this.cssW = r.width;
    this.cssH = r.height;
  }
  mesh(geo) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = (data, loc, size) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    buf(geo.pos, 0, 3);
    buf(geo.nor, 1, 3);
    buf(geo.uv, 2, 2);
    const big = geo.pos.length / 3 > 65535;
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, big ? new Uint32Array(geo.idx) : new Uint16Array(geo.idx), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: geo.idx.length, type: big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
  }
  begin(eye, target, fov = 0.5, near = 0.05, far = 30) {
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.proj = M4.persp(fov, this.aspect, near, far);
    this.vp = M4.mul(this.proj, M4.lookAt(eye, target));
    this.eye = eye;
  }
  draw(mesh, model, mat) {
    const gl = this.gl;
    const u = this.u;
    gl.useProgram(this.p);
    gl.uniformMatrix4fv(u.uModel, false, model);
    gl.uniformMatrix4fv(u.uVP, false, this.vp);
    gl.uniformMatrix3fv(u.uNM, false, normalMatrix(model));
    gl.uniform3fv(u.uCam, this.eye);
    gl.uniform3fv(u.uColor, mat.color);
    gl.uniform3fv(u.uEmit, mat.emit || [0, 0, 0]);
    gl.uniform1f(u.uRough, mat.rough);
    gl.uniform1f(u.uMetal, mat.metal || 0);
    gl.uniform1f(u.uAlpha, mat.alpha == null ? 1 : mat.alpha);
    gl.uniform1f(u.uEnv, mat.env == null ? 1 : mat.env);
    gl.uniform1f(u.uEnvRot, this.envRot);
    gl.bindVertexArray(mesh.vao);
    gl.drawElements(gl.TRIANGLES, mesh.count, mesh.type, 0);
  }
  lineMesh(pos) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return { vao, count: pos.length / 3 };
  }
  line(mesh, model, rgba) {
    const gl = this.gl;
    gl.useProgram(this.lp);
    gl.depthMask(false);
    gl.uniformMatrix4fv(this.lu.uModel, false, model);
    gl.uniformMatrix4fv(this.lu.uVP, false, this.vp);
    gl.uniform3fv(this.lu.uCam, this.eye);
    gl.uniform4fv(this.lu.uCol, rgba);
    gl.bindVertexArray(mesh.vao);
    gl.drawArrays(gl.LINE_LOOP, 0, mesh.count);
    gl.depthMask(true);
  }
  glow(c, size, rgb, a) {
    const gl = this.gl;
    gl.useProgram(this.gp);
    gl.depthMask(false);
    gl.uniformMatrix4fv(this.gu.uVP, false, this.vp);
    gl.uniform3fv(this.gu.uC, c);
    gl.uniform1f(this.gu.uS, size);
    gl.uniform2f(this.gu.uP, this.proj[0], this.proj[5]);
    gl.uniform3fv(this.gu.uCol, rgb);
    gl.uniform1f(this.gu.uA, a);
    gl.bindVertexArray(this.quad.vao);
    gl.drawElements(gl.TRIANGLES, this.quad.count, this.quad.type, 0);
    gl.depthMask(true);
  }
  // Proyección a píxeles CSS del lienzo: [x, y, w]
  project(p) {
    const v = this.vp;
    const x = v[0] * p[0] + v[4] * p[1] + v[8] * p[2] + v[12];
    const y = v[1] * p[0] + v[5] * p[1] + v[9] * p[2] + v[13];
    const w = v[3] * p[0] + v[7] * p[1] + v[11] * p[2] + v[15];
    return [(x / w * 0.5 + 0.5) * this.cssW, (1 - (y / w * 0.5 + 0.5)) * this.cssH, w];
  }
  shadow(x, y, z, rx, rz, strength) {
    const gl = this.gl;
    gl.useProgram(this.sp);
    gl.depthMask(false);
    gl.uniformMatrix4fv(this.su.uVP, false, this.vp);
    gl.uniform3f(this.su.uC, x, y, z);
    gl.uniform2f(this.su.uR, rx, rz);
    gl.uniform1f(this.su.uS, strength);
    gl.bindVertexArray(this.quad.vao);
    gl.drawElements(gl.TRIANGLES, this.quad.count, this.quad.type, 0);
    gl.depthMask(true);
  }
}

// Bucle de render que solo corre mientras el lienzo está a la vista.
export function loop(el, frame) {
  let raf = 0;
  let visible = false;
  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    frame(dt, now / 1000);
    raf = requestAnimationFrame(tick);
  };
  const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !document.hidden) start(); else stop();
    }, { rootMargin: '80px' }).observe(el);
  } else { visible = true; start(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (visible) start(); });
  return { start, stop, get running() { return !!raf; } };
}
