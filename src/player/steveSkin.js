import * as THREE from 'three';

const PX = 8; // upscale factor (skin pixels → canvas pixels)

let _canvas = null;

function buildSkin() {
  const cv = document.createElement('canvas');
  cv.width  = 64 * PX;
  cv.height = 64 * PX;
  const g = cv.getContext('2d');

  const fill = (x, y, w, h, c) => {
    g.fillStyle = c;
    g.fillRect(x * PX, y * PX, w * PX, h * PX);
  };

  // ── HEAD (skin region 0-32, 0-16) ──────────────────────────────
  // top (hair)
  fill( 8,  0, 8, 8, '#5a3e2b');
  // bottom
  fill(16,  0, 8, 8, '#c9a87c');
  // right (+X) side
  fill( 0,  8, 8, 8, '#c9a87c');
  // front face (-Z): skin + features
  fill( 8,  8, 8, 8, '#c9a87c');
  fill( 9, 10, 2, 2, '#ffffff');                                   // L eye white
  fill( 9, 11, 1, 1, '#1a0a00'); fill(10, 11, 1, 1, '#1a0a00');  // L pupil
  fill(13, 10, 2, 2, '#ffffff');                                   // R eye white
  fill(13, 11, 1, 1, '#1a0a00'); fill(14, 11, 1, 1, '#1a0a00');  // R pupil
  fill(12, 12, 1, 2, '#b08060');                                   // nose
  fill(10, 14, 1, 1, '#3a1a0a'); fill(11, 14, 3, 1, '#c06050'); fill(14, 14, 1, 1, '#3a1a0a'); // mouth
  // left (-X) side
  fill(16,  8, 8, 8, '#c9a87c');
  // back (+Z)
  fill(24,  8, 8, 8, '#7d6240');

  // ── BODY (region 16-40, 16-32) ─────────────────────────────────
  fill(20, 16,  8,  4, '#6a8ab6'); // top
  fill(28, 16,  8,  4, '#6a8ab6'); // bottom
  fill(16, 20,  4, 12, '#6a8ab6'); // right (+X)
  fill(20, 20,  8, 12, '#7798c5'); // front (-Z)
  fill(28, 20,  4, 12, '#6a8ab6'); // left  (-X)
  fill(32, 20,  8, 12, '#5a7aa8'); // back  (+Z)

  // ── ARM (region 40-56, 16-32) — used for both arms ─────────────
  fill(44, 16,  4,  4, '#b89060'); // top
  fill(48, 16,  4,  4, '#b89060'); // bottom
  fill(40, 20,  4, 12, '#c9a87c'); // right (+X)
  fill(44, 20,  4, 12, '#c9a87c'); // front (-Z)
  fill(48, 20,  4, 12, '#c9a87c'); // left  (-X)
  fill(52, 20,  4, 12, '#c9a87c'); // back  (+Z)

  // ── LEG (region 0-16, 16-32) — used for both legs ──────────────
  fill( 4, 16,  4,  4, '#3a5fa5'); // top
  fill( 8, 16,  4,  4, '#3a5fa5'); // bottom
  fill( 0, 20,  4,  8, '#3a5fa5'); // right  (+X) pants
  fill( 4, 20,  4,  8, '#3a5fa5'); // front  (-Z) pants
  fill( 8, 20,  4,  8, '#3a5fa5'); // left   (-X) pants
  fill(12, 20,  4,  8, '#3a5fa5'); // back   (+Z) pants
  fill( 0, 28,  4,  4, '#593d29'); // right  shoe
  fill( 4, 28,  4,  4, '#593d29'); // front  shoe
  fill( 8, 28,  4,  4, '#593d29'); // left   shoe
  fill(12, 28,  4,  4, '#593d29'); // back   shoe

  return cv;
}

function skin() {
  if (!_canvas) _canvas = buildSkin();
  return _canvas;
}

function crop(sx, sy, sw, sh) {
  const s = skin();
  const cv = document.createElement('canvas');
  cv.width  = sw * PX;
  cv.height = sh * PX;
  cv.getContext('2d').drawImage(s, sx*PX, sy*PX, sw*PX, sh*PX, 0, 0, sw*PX, sh*PX);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  return new THREE.MeshBasicMaterial({ map: t });
}

// BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
// Player body faces -Z when yaw=0 → -Z = front, +Z = back

export function headMats() {
  return [
    crop( 0,  8, 8, 8), // +X right
    crop(16,  8, 8, 8), // -X left
    crop( 8,  0, 8, 8), // +Y top  (hair)
    crop(16,  0, 8, 8), // -Y bottom
    crop(24,  8, 8, 8), // +Z back
    crop( 8,  8, 8, 8), // -Z front (face)
  ];
}

export function torsoMats() {
  return [
    crop(16, 20, 4, 12), // +X right
    crop(28, 20, 4, 12), // -X left
    crop(20, 16, 8,  4), // +Y top
    crop(28, 16, 8,  4), // -Y bottom
    crop(32, 20, 8, 12), // +Z back
    crop(20, 20, 8, 12), // -Z front
  ];
}

export function armMats() {
  return [
    crop(40, 20, 4, 12), // +X
    crop(48, 20, 4, 12), // -X
    crop(44, 16, 4,  4), // +Y top
    crop(48, 16, 4,  4), // -Y bottom
    crop(52, 20, 4, 12), // +Z back
    crop(44, 20, 4, 12), // -Z front
  ];
}

export function legMats() {
  return [
    crop( 0, 20, 4, 12), // +X right
    crop( 8, 20, 4, 12), // -X left
    crop( 4, 16, 4,  4), // +Y top
    crop( 8, 16, 4,  4), // -Y bottom
    crop(12, 20, 4, 12), // +Z back
    crop( 4, 20, 4, 12), // -Z front
  ];
}
