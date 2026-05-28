import * as THREE from 'three';
import { grassUniforms } from './Chunk.js';

// Keyframe tables: time 0=midnight · 0.25=sunrise · 0.5=noon · 0.75=sunset

const SKY_KF = [
  [0.00,   4,   4,  18],
  [0.21,   8,   8,  32],
  [0.25, 248, 108,  44],
  [0.33,  88, 158, 210],
  [0.50, 132, 204, 234],
  [0.67, 100, 178, 214],
  [0.75, 252,  82,  20],
  [0.82,  14,   8,  32],
  [1.00,   4,   4,  18],
];

const AMB_KF = [
  [0.00, 0.035, 0.038, 0.110],
  [0.21, 0.055, 0.058, 0.140],
  [0.25, 0.780, 0.460, 0.210],
  [0.33, 0.920, 0.880, 0.800],
  [0.50, 1.000, 1.000, 1.000],
  [0.67, 0.920, 0.880, 0.780],
  [0.75, 0.820, 0.380, 0.140],
  [0.82, 0.055, 0.038, 0.110],
  [1.00, 0.035, 0.038, 0.110],
];

const FOG_KF = [
  [0.00, 0.011],
  [0.28, 0.006],
  [0.50, 0.004],
  [0.72, 0.006],
  [0.80, 0.011],
  [1.00, 0.011],
];

function lerp(kf, t) {
  for (let i = 0; i < kf.length - 1; i++) {
    const a = kf[i], b = kf[i + 1];
    if (t <= b[0]) {
      const f = (t - a[0]) / (b[0] - a[0]);
      return a.slice(1).map((v, j) => v + (b[j + 1] - v) * f);
    }
  }
  return kf[kf.length - 1].slice(1);
}

// ── Cloud texture helpers ─────────────────────────────────────────────────────

function _ch(n) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 0x100000000;
}

function _csn(x, y, seed, period = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const s = (seed * 7331) | 0;
  // When period > 0 wrap grid coords so the noise tiles seamlessly
  const x0 = period > 0 ? ((xi % period + period) % period) : xi;
  const x1 = period > 0 ? ((xi + 1) % period + period) % period : xi + 1;
  const y0 = period > 0 ? ((yi % period + period) % period) : yi;
  const y1 = period > 0 ? ((yi + 1) % period + period) % period : yi + 1;
  const n00 = _ch(x0 * 127 + y0 * 311 + s);
  const n10 = _ch(x1 * 127 + y0 * 311 + s);
  const n01 = _ch(x0 * 127 + y1 * 311 + s);
  const n11 = _ch(x1 * 127 + y1 * 311 + s);
  return n00 + (n10 - n00) * u + (n01 - n00) * v + (n00 - n10 - n01 + n11) * u * v;
}

function _cfbm(x, y, seed, octs = 5, tileable = false) {
  let val = 0, amp = 0.5, total = 0;
  for (let i = 0; i < octs; i++) {
    const scale = 1 << i;
    // Each octave wraps at its own period (base period 4 × octave scale)
    const period = tileable ? 4 * scale : 0;
    val += _csn(x * scale, y * scale, seed + i, period) * amp;
    total += amp;
    amp *= 0.5;
  }
  return val / total;
}

function _buildMoonGlowTexture() {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(S/2, S/2, 0, S/2, S/2, S/2);
  grad.addColorStop(0.00, 'rgba(230,240,255,1)');
  grad.addColorStop(0.09, 'rgba(200,220,255,1)');
  grad.addColorStop(0.14, 'rgba(160,190,240,0.80)');
  grad.addColorStop(0.30, 'rgba(120,160,220,0.35)');
  grad.addColorStop(0.55, 'rgba(80,120,200,0.14)');
  grad.addColorStop(1.00, 'rgba(60,100,180,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(canvas);
}

function _buildGlowTexture() {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(S/2, S/2, 0, S/2, S/2, S/2);
  grad.addColorStop(0.00, 'rgba(255,255,240,1)');
  grad.addColorStop(0.09, 'rgba(255,248,200,1)');
  grad.addColorStop(0.14, 'rgba(255,230,140,0.80)');
  grad.addColorStop(0.30, 'rgba(255,200,80,0.35)');
  grad.addColorStop(0.55, 'rgba(255,160,40,0.14)');
  grad.addColorStop(1.00, 'rgba(255,120,20,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(canvas);
}

function buildCloudTexture() {
  const S = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(S, S);
  const d = img.data;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const val = _cfbm(x / S * 4, y / S * 4, 17, 5, true);
      const threshold = 0.52;
      if (val > threshold) {
        const alpha = Math.min(1, (val - threshold) / 0.18) * 220;
        const i = (y * S + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = 255;
        d[i + 3] = Math.round(alpha);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ── Sky class ─────────────────────────────────────────────────────────────────

const D = 390; // celestial sphere radius

export class Sky {
  constructor(scene) {
    this._scene = scene;
    this.time      = 0.35;
    this.ambient   = [1, 1, 1];
    this.dayLength = 480;

    // ── Sun ──
    this._sunGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: _buildGlowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this._sunGlow.scale.setScalar(260);
    scene.add(this._sunGlow);

    // ── Moon ──
    this._moonGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: _buildMoonGlowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this._moonGlow.scale.setScalar(200);
    scene.add(this._moonGlow);

    // ── Stars ──
    const N = 2000;
    const pts = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const phi   = Math.acos(1 - 2 * Math.random());
      const theta = Math.PI * 2 * Math.random();
      pts[i*3]   = D * Math.sin(phi) * Math.cos(theta);
      pts[i*3+1] = D * Math.cos(phi);
      pts[i*3+2] = D * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this._starMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 1.6, transparent: true, opacity: 0, sizeAttenuation: true,
    });
    this._stars = new THREE.Points(geo, this._starMat);
    scene.add(this._stars);

    // ── Clouds ──
    this._cloudTex = buildCloudTexture();
    this._cloudTex.repeat.set(3, 3);
    this._cloudMat = new THREE.MeshBasicMaterial({
      map: this._cloudTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const cloudGeo = new THREE.PlaneGeometry(900, 900);
    this._cloudMesh = new THREE.Mesh(cloudGeo, this._cloudMat);
    this._cloudMesh.rotation.x = -Math.PI / 2;
    this._cloudMesh.position.y = 90;
    scene.add(this._cloudMesh);
    this._cloudOffset = 0;
  }

  update(dt, camera, solidMat, waterMat) {
    this.time = (this.time + dt / this.dayLength) % 1;
    const t = this.time;

    const angle = (t - 0.25) * Math.PI * 2;
    const sinA  = Math.sin(angle);
    const cosA  = Math.cos(angle);
    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;

    const sx = cx + cosA * D, sy = cy + sinA * D;
    this._sunGlow.position.set(sx, sy, cz);
    this._moonGlow.position.set(cx - cosA * D, cy - sinA * D, cz);
    this._stars.position.set(cx, cy, cz);

    // ── Sky & fog ──
    const [sr, sg, sb] = lerp(SKY_KF, t);
    this._scene.background.setRGB(sr / 255, sg / 255, sb / 255);
    this._scene.fog.color.setRGB(sr / 255, sg / 255, sb / 255);
    this._scene.fog.density = lerp(FOG_KF, t)[0];

    // ── World tint ──
    const [ar, ag, ab] = lerp(AMB_KF, t);
    this.ambient = [ar, ag, ab];
    solidMat.color.setRGB(ar, ag, ab);
    waterMat.uniforms.uAmbient.value.set(ar, ag, ab);
    grassUniforms.uAmbient.value.setRGB(ar, ag, ab);

    // ── Sun color shifts orange near horizon ──
    const horizBlend = Math.max(0, 1 - Math.abs(sinA) * 2.5);
    this._sunGlow.material.color.setRGB(1.0, 0.92 - horizBlend * 0.50, 0.45 - horizBlend * 0.40);
    this._sunGlow.material.opacity = 0.9 + horizBlend * 0.1;
    // ── Moon color shifts warm near horizon ──
    const moonHorizBlend = Math.max(0, 1 - Math.abs(-sinA) * 2.5);
    const nightBlend = Math.max(0, Math.min(1, -sinA * 3.0));
    this._moonGlow.material.color.setRGB(0.90 + moonHorizBlend * 0.10, 0.88 - moonHorizBlend * 0.20, 1.0 - moonHorizBlend * 0.35);
    this._moonGlow.material.opacity = (0.5 + nightBlend * 0.5) * (0.9 + moonHorizBlend * 0.1);

    // ── Stars ──
    this._starMat.opacity = Math.max(0, Math.min(1, -sinA * 2.5 + 0.15));

    // ── Clouds: drift with wind, tint follows ambient light ──
    this._cloudOffset += dt * 0.003;
    this._cloudTex.offset.x = this._cloudOffset;
    this._cloudMesh.position.x = cx;
    this._cloudMesh.position.z = cz;
    // Clouds pick up sunrise/sunset orange tint via ambient; fade at night
    this._cloudMat.color.setRGB(
      Math.min(1, ar + 0.08),
      Math.min(1, ag + 0.08),
      Math.min(1, ab + 0.08),
    );
    this._cloudMat.opacity = Math.max(0.08, Math.min(0.85, ar * 1.1));
  }

  timeString() {
    const totalH = this.time * 24;
    const h = Math.floor(totalH) % 24;
    const m = Math.floor((totalH % 1) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
