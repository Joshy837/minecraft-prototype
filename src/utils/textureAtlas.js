const T    = 16; // pixels per tile
const COLS = 4;  // tiles per atlas row

export const TILE = {
  GRASS_TOP:  0,
  GRASS_SIDE: 1,
  DIRT:       2,
  STONE:      3,
  LOG_TOP:    4,
  LOG_SIDE:   5,
  SAND:       6,
  GRAVEL:     7,
  SNOW_TOP:   8,
  SNOW_SIDE:  9,
  LEAVES:     10,
  WATER:      11,
  PATH:       12,
  // 16 Minecraft-style colored blocks
  WHITE:      13,
  ORANGE:     14,
  MAGENTA:    15,
  LIGHT_BLUE: 16,
  YELLOW:     17,
  LIME:       18,
  PINK:       19,
  GRAY:       20,
  LIGHT_GRAY: 21,
  CYAN:       22,
  PURPLE:     23,
  BLUE:       24,
  BROWN:      25,
  GREEN:      26,
  RED:        27,
  BLACK:      28,
  COBBLESTONE:    29,
  DOOR:           30,
  TALL_GRASS:     31,
  BIRCH_LOG_TOP:  32,
  BIRCH_LOG_SIDE: 33,
  SPRUCE_LOG_TOP: 34,
  SPRUCE_LOG_SIDE:35,
  BIRCH_LEAVES:   36,
  SPRUCE_LEAVES:  37,
  BUCKET:         38,
  WATER_BUCKET:   39,
  COAL_ORE:       40,
  IRON_ORE:       41,
  GOLD_ORE:       42,
  LAPIS_ORE:      43,
  REDSTONE_ORE:   44,
  DIAMOND_ORE:    45,
  GLASS:          46,
};

const NUM_TILES  = Object.keys(TILE).length;
const TOTAL_ROWS = Math.ceil(NUM_TILES / COLS);

export const ATLAS_PIX_U = 1 / (COLS * T);
export const ATLAS_PIX_V = 1 / (TOTAL_ROWS * T);

function h(n) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 0x100000000;
}
function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }

function sn(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const s = (seed * 7331) | 0;
  const n00 = h(xi * 127 + yi * 311 + s);
  const n10 = h((xi + 1) * 127 + yi * 311 + s);
  const n01 = h(xi * 127 + (yi + 1) * 311 + s);
  const n11 = h((xi + 1) * 127 + (yi + 1) * 311 + s);
  return n00 + (n10 - n00) * u + (n01 - n00) * v + (n00 - n10 - n01 + n11) * u * v;
}

function fbm(x, y, seed, octs = 3, pers = 0.5) {
  let val = 0, amp = 0.5, total = 0;
  for (let i = 0; i < octs; i++) {
    val += sn(x * (1 << i), y * (1 << i), seed + i) * amp;
    total += amp;
    amp *= pers;
  }
  return val / total;
}

// ── Per-tile drawing functions ────────────────────────────────────────────────

function _drawGrassTop(put) {
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    const n = fbm(px * 0.22, py * 0.22, 1, 3);
    const f = fbm(px * 0.55, py * 0.55, 7, 2);
    const t = n * 0.7 + f * 0.3;
    put(TILE.GRASS_TOP, px, py, 70 + t * 46, 136 + t * 58, 26 + t * 28);
  }
}

function _drawGrassSide(put) {
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    if (py <= 2) {
      const n = fbm(px * 0.22, 0, 1, 3);
      const f = fbm(px * 0.55, 0, 7, 2);
      const t = n * 0.7 + f * 0.3;
      put(TILE.GRASS_SIDE, px, py, 70 + t * 46, 136 + t * 58, 26 + t * 28);
    } else {
      const n = fbm(px * 0.22, py * 0.22, 20, 3);
      const f = fbm(px * 0.5,  py * 0.5,  21, 2);
      const t = n * 0.7 + f * 0.3;
      put(TILE.GRASS_SIDE, px, py, 118 + t * 36, 84 + t * 28, 42 + t * 20);
    }
  }
}

function _drawDirt(put) {
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    const n = fbm(px * 0.22, py * 0.22, 20, 3);
    const f = fbm(px * 0.5,  py * 0.5,  21, 2);
    const t = n * 0.7 + f * 0.3;
    put(TILE.DIRT, px, py, 118 + t * 36, 84 + t * 28, 42 + t * 20);
  }
}

function _drawStone(put) {
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    const n = fbm(px * 0.2, py * 0.2, 30, 3);
    const base = 108 + n * 34;
    const vein = fbm(px * 0.45, py * 0.45, 37, 2);
    const dark = (vein > 0.76 && vein < 0.83) ? -30 : 0;
    put(TILE.STONE, px, py, base + dark, base + dark, base + 4 + dark);
  }
}

function _drawLogTop(put) {
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    const dx = px - 7.5, dy = py - 7.5;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const distort = (fbm(px * 0.35, py * 0.35, 42, 2) - 0.5) * 1.8;
    const ring = Math.floor((dist + distort) * 0.75) % 2;
    const nv = (fbm(px * 0.28, py * 0.28, 44, 2) - 0.5) * 12;
    const [r, g, b] = ring === 0
      ? [172 + nv, 136 + nv, 62 + nv]
      : [144 + nv, 108 + nv, 46 + nv];
    put(TILE.LOG_TOP, px, py, r, g, b);
  }
}

function _drawLogSide(put) {
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    const grain  = sn(px * 0.60, py * 0.10, 50);
    const coarse = sn(px * 0.25, py * 0.07, 51);
    const t = grain * 0.55 + coarse * 0.45;
    put(TILE.LOG_SIDE, px, py, 108 + t * 58, 76 + t * 44, 30 + t * 28);
  }
}

function _drawSand(put) {
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    const n = fbm(px * 0.18, py * 0.18, 60, 2);
    put(TILE.SAND, px, py, 208 + n * 20, 192 + n * 16, 124 + n * 14);
  }
}

function _drawGravel(put) {
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    let minD = 99, secD = 99, minId = 0;
    for (let cy = -1; cy <= 1; cy++) {
      for (let cx2 = -1; cx2 <= 1; cx2++) {
        const gx = Math.floor(px / 4) + cx2;
        const gy = Math.floor(py / 4) + cy;
        const jx = h(gx * 127 + gy * 311 + 6200) * 0.65 + 0.175;
        const jy = h(gx * 127 + gy * 311 + 6201) * 0.65 + 0.175;
        const fpx = (gx + jx) * 4, fpy = (gy + jy) * 4;
        const dd = Math.hypot(px - fpx, py - fpy);
        if (dd < minD) { secD = minD; minD = dd; minId = h(gx * 17 + gy * 31 + 6202); }
        else if (dd < secD) secD = dd;
      }
    }
    const edge     = Math.max(0, 1 - (secD - minD) * 1.4);
    const stoneBase = 104 + minId * 52;
    const edgeDark  = edge * 36;
    put(TILE.GRAVEL, px, py, stoneBase - edgeDark, stoneBase - 4 - edgeDark, stoneBase - 10 - edgeDark);
  }
}

function _drawSnowTop(put) {
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    const n = fbm(px * 0.22, py * 0.22, 80, 2) * 0.5 + 0.5;
    put(TILE.SNOW_TOP, px, py, 234 + n * 18, 238 + n * 14, 248 + n * 6);
  }
}

function _drawSnowSide(put) {
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    if (py <= 2) {
      const n = fbm(px * 0.22, 0, 80, 2) * 0.5 + 0.5;
      put(TILE.SNOW_SIDE, px, py, 234 + n * 18, 238 + n * 14, 248 + n * 6);
    } else {
      const n = fbm(px * 0.22, py * 0.22, 20, 3);
      const f = fbm(px * 0.5,  py * 0.5,  21, 2);
      const t = n * 0.7 + f * 0.3;
      put(TILE.SNOW_SIDE, px, py, 118 + t * 36, 84 + t * 28, 42 + t * 20);
    }
  }
}

function _drawLeaves(put) {
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    const n = fbm(px * 0.32, py * 0.32, 90, 3);
    const f = fbm(px * 0.65, py * 0.65, 95, 2);
    const t = n * 0.65 + f * 0.35;
    if (n < 0.30) put(TILE.LEAVES, px, py, 0, 0, 0, 0);
    else          put(TILE.LEAVES, px, py, 38 + t * 42, 90 + t * 56, 18 + t * 26);
  }
}

function _drawWater(put) {
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    const n1 = fbm(px * 0.28, py * 0.28, 100, 3);
    const n2 = fbm(px * 0.58, py * 0.58, 105, 2);
    const t  = n1 * 0.65 + n2 * 0.35;
    const caustic = sn(px * 0.85, py * 0.85, 110) > 0.80 ? 28 : 0;
    put(TILE.WATER, px, py, 20 + t * 26 + caustic, 68 + t * 38 + caustic, 168 + t * 34 + caustic);
  }
}

function _drawPath(put) {
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    const n = fbm(px * 0.28, py * 0.28, 120, 3);
    const f = fbm(px * 0.62, py * 0.62, 121, 2);
    const t = n * 0.6 + f * 0.4;
    const pebble = sn(px * 0.72, py * 0.72, 122) > 0.84 ? -22 : 0;
    put(TILE.PATH, px, py, 148 + t * 32 + pebble, 128 + t * 26 + pebble, 86 + t * 22 + pebble);
  }
}

function _drawColoredBlocks(put) {
  const WOOL_RGB = [
    [229,229,229],[216,127, 51],[178, 76,216],[102,153,216],
    [229,229, 51],[127,204, 25],[242,127,165],[ 76, 76, 76],
    [153,153,153],[ 76,127,153],[127, 63,178],[ 51, 76,178],
    [102, 76, 51],[102,127, 51],[153, 51, 51],[ 25, 25, 25],
  ];
  for (let c = 0; c < 16; c++) {
    const [wr, wg, wb] = WOOL_RGB[c];
    for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
      const n = fbm(px * 0.30, py * 0.30, 200 + c * 7, 2);
      const t = (n - 0.5) * 14;
      put(TILE.WHITE + c, px, py, wr + t, wg + t, wb + t);
    }
  }
}

function _drawCobblestone(put) {
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    let minD = 99, secD = 99, minId = 0;
    for (let cy = -1; cy <= 1; cy++) {
      for (let cx2 = -1; cx2 <= 1; cx2++) {
        const gx = Math.floor(px / 5) + cx2;
        const gy = Math.floor(py / 5) + cy;
        const jx = h(gx * 127 + gy * 311 + 7300) * 0.60 + 0.20;
        const jy = h(gx * 127 + gy * 311 + 7301) * 0.60 + 0.20;
        const fpx = (gx + jx) * 5, fpy = (gy + jy) * 5;
        const dd = Math.hypot(px - fpx, py - fpy);
        if (dd < minD) { secD = minD; minD = dd; minId = h(gx * 17 + gy * 31 + 7302); }
        else if (dd < secD) secD = dd;
      }
    }
    const edge     = Math.max(0, 1 - (secD - minD) * 1.3);
    const sb       = 108 + minId * 44;
    const edgeDark = edge * 55;
    put(TILE.COBBLESTONE, px, py, sb - edgeDark, sb - edgeDark, sb + 1 - edgeDark);
  }
}

function _drawDoor(put) {
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    const isFrameX  = px < 2 || px >= 14;
    const isFrameY  = py < 2 || py >= 14;
    const isFrame   = isFrameX || isFrameY;
    const isDivider = !isFrameX && (py === 7 || py === 8);
    const isKnob    = (px === 12 || px === 13) && py === 6;
    if (isKnob) {
      put(TILE.DOOR, px, py, 48, 28, 10);
    } else if (isFrame || isDivider) {
      put(TILE.DOOR, px, py, 72, 44, 16);
    } else {
      const grain = sn(px * 0.3, py * 0.55, 9001);
      const t = grain * 0.4 + 0.6;
      put(TILE.DOOR, px, py, 152 * t, 98 * t, 42 * t);
    }
  }
}

function _drawTallGrass(put) {
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    const tFade = 1 - py / (T - 1);
    let closest = Infinity;
    for (const bc of [2, 6, 10, 14]) {
      const lean  = (h(bc * 17 + 91) - 0.5) * 3;
      const bladeX = bc + lean * tFade;
      closest = Math.min(closest, Math.abs(px - bladeX));
    }
    const n = fbm(px * 0.45, py * 0.45, 300, 3);
    const bladeWidth = 0.75 + n * 0.35;
    if (closest < bladeWidth) {
      const gr = 80 + n * 55 + tFade * 30;
      put(TILE.TALL_GRASS, px, py, 30 + n * 22, gr, 14 + n * 14);
    } else {
      put(TILE.TALL_GRASS, px, py, 0, 0, 0, 0);
    }
  }
}

function _drawBirchLogTop(put) {
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    const dx = px - 7.5, dy = py - 7.5;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const distort = (fbm(px * 0.35, py * 0.35, 500, 2) - 0.5) * 1.5;
    const ring = Math.floor((dist + distort) * 0.75) % 2;
    const nv = (fbm(px * 0.28, py * 0.28, 502, 2) - 0.5) * 10;
    const [r, g, b] = ring === 0
      ? [218 + nv, 210 + nv, 190 + nv]
      : [185 + nv, 178 + nv, 160 + nv];
    put(TILE.BIRCH_LOG_TOP, px, py, r, g, b);
  }
}

function _drawBirchLogSide(put) {
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    const base   = fbm(px * 0.50, py * 0.12, 510, 2);
    const t      = base * 0.4 + 0.6;
    const stripe = (py % 5 < 1) && (sn(px * 0.3, py * 0.2, 512) > 0.55);
    if (stripe) put(TILE.BIRCH_LOG_SIDE, px, py, 80, 76, 68);
    else        put(TILE.BIRCH_LOG_SIDE, px, py, 210 * t, 205 * t, 188 * t);
  }
}

function _drawSpruceLogTop(put) {
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    const dx = px - 7.5, dy = py - 7.5;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const distort = (fbm(px * 0.35, py * 0.35, 520, 2) - 0.5) * 1.8;
    const ring = Math.floor((dist + distort) * 0.75) % 2;
    const nv = (fbm(px * 0.28, py * 0.28, 522, 2) - 0.5) * 8;
    const [r, g, b] = ring === 0
      ? [100 + nv, 72 + nv, 36 + nv]
      : [74 + nv, 52 + nv, 24 + nv];
    put(TILE.SPRUCE_LOG_TOP, px, py, r, g, b);
  }
}

function _drawSpruceLogSide(put) {
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    const grain  = sn(px * 0.60, py * 0.10, 530);
    const coarse = sn(px * 0.25, py * 0.07, 531);
    const t = grain * 0.55 + coarse * 0.45;
    put(TILE.SPRUCE_LOG_SIDE, px, py, 76 + t * 42, 52 + t * 30, 22 + t * 18);
  }
}

function _drawBirchLeaves(put) {
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    const n = fbm(px * 0.32, py * 0.32, 540, 3);
    const f = fbm(px * 0.65, py * 0.65, 545, 2);
    const t = n * 0.65 + f * 0.35;
    if (n < 0.28) put(TILE.BIRCH_LEAVES, px, py, 0, 0, 0, 0);
    else          put(TILE.BIRCH_LEAVES, px, py, 80 + t * 48, 136 + t * 60, 22 + t * 30);
  }
}

function _drawSpruceLeaves(put) {
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    const n = fbm(px * 0.32, py * 0.32, 550, 3);
    const f = fbm(px * 0.65, py * 0.65, 555, 2);
    const t = n * 0.65 + f * 0.35;
    if (n < 0.18) put(TILE.SPRUCE_LEAVES, px, py, 0, 0, 0, 0);
    else          put(TILE.SPRUCE_LEAVES, px, py, 22 + t * 28, 66 + t * 42, 30 + t * 24);
  }
}

function _drawBuckets(put) {
  for (let variant = 0; variant < 2; variant++) {
    const ti = TILE.BUCKET + variant;
    for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
      if (py === 0 && px >= 5 && px <= 10) {
        put(ti, px, py, 200, 200, 200);
      } else if ((py === 1 || py === 2) && (px === 3 || px === 12)) {
        put(ti, px, py, 200, 200, 200);
      } else if (py === 3 && px >= 2 && px <= 13) {
        put(ti, px, py, 150, 150, 150);
      } else if (py >= 4 && py <= 11) {
        const step = Math.floor((py - 4) / 2);
        const le = 2 + step, re = 13 - step;
        if (px === le || px === re) {
          put(ti, px, py, 170, 170, 170);
        } else if (variant === 1 && px > le && px < re && py >= 6) {
          const alpha = py <= 7 ? 180 : 220;
          put(ti, px, py, 28, 80, 200, alpha);
        }
      } else if (py === 12 && px >= 5 && px <= 10) {
        put(ti, px, py, 150, 150, 150);
      }
    }
  }
}

function _drawOres(put) {
  const ORE_SPECS = [
    { ti: TILE.COAL_ORE,     or: [38,38,38],    ob: [22,22,22]   },
    { ti: TILE.IRON_ORE,     or: [210,160,100], ob: [180,130,75] },
    { ti: TILE.GOLD_ORE,     or: [255,215,0],   ob: [230,180,0]  },
    { ti: TILE.LAPIS_ORE,    or: [28,90,230],   ob: [16,60,190]  },
    { ti: TILE.REDSTONE_ORE, or: [255,80,0],    ob: [200,55,0]   },
    { ti: TILE.DIAMOND_ORE,  or: [60,240,235],  ob: [20,200,195] },
  ];
  for (const { ti, or: oc, ob } of ORE_SPECS) {
    const seed = ti * 53 + 4000;
    for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
      const sn2 = fbm(px * 0.2, py * 0.2, seed, 3);
      const stoneBase = 108 + sn2 * 34;
      const vein2 = fbm(px * 0.45, py * 0.45, seed + 7, 2);
      const dark2 = (vein2 > 0.76 && vein2 < 0.83) ? -30 : 0;
      let [r, g, b] = [stoneBase + dark2, stoneBase + dark2, stoneBase + 4 + dark2];

      const edgeDist = Math.min(px, py, T - 1 - px, T - 1 - py);
      const edgeFade = Math.min(edgeDist / 2, 1);
      const m1   = fbm(px * 0.55, py * 0.55, seed + 100, 3);
      const m2   = fbm(px * 0.28, py * 0.28, seed + 200, 2);
      const mask = (m1 * 0.6 + m2 * 0.4) * edgeFade;

      if (mask > 0.70) {
        const detail = (fbm(px * 0.9, py * 0.9, seed + 300, 2) - 0.5) * 28;
        const shine  = mask > 0.72 ? 20 : 0;
        r = oc[0] + detail + shine;
        g = oc[1] + detail * 0.6 + shine;
        b = oc[2] + detail * 0.4 + shine;
      } else if (mask > 0.52) {
        const t = (mask - 0.52) / 0.06;
        r = r + (ob[0] - r) * t;
        g = g + (ob[1] - g) * t;
        b = b + (ob[2] - b) * t;
      }
      put(ti, px, py, r, g, b);
    }
  }
}

function _drawGlass(put) {
  const glassDotCorners = [[11,2],[2,10]];
  const glassDots = new Set();
  for (const [dx, dy] of glassDotCorners) {
    glassDots.add(`${dx},${dy}`);
    glassDots.add(`${dx+1},${dy+1}`);
  }
  for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
    const onEdge = px === 0 || px === T-1 || py === 0 || py === T-1;
    if (onEdge) {
      put(TILE.GLASS, px, py, 200, 232, 240, 255);
    } else if (glassDots.has(`${px},${py}`)) {
      put(TILE.GLASS, px, py, 155, 208, 228, 255);
    } else {
      put(TILE.GLASS, px, py, 0, 0, 0, 0);
    }
  }
}

// ── Atlas builder ─────────────────────────────────────────────────────────────

export function buildAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width  = T * COLS;
  canvas.height = T * TOTAL_ROWS;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(canvas.width, canvas.height);
  const d   = img.data;

  function put(tile, px, py, r, g, b, a = 255) {
    const x = (tile % COLS) * T + px;
    const y = Math.floor(tile / COLS) * T + py;
    const i = (y * canvas.width + x) * 4;
    d[i] = clamp(r); d[i+1] = clamp(g); d[i+2] = clamp(b); d[i+3] = Math.max(0, Math.min(255, Math.round(a)));
  }

  _drawGrassTop(put);
  _drawGrassSide(put);
  _drawDirt(put);
  _drawStone(put);
  _drawLogTop(put);
  _drawLogSide(put);
  _drawSand(put);
  _drawGravel(put);
  _drawSnowTop(put);
  _drawSnowSide(put);
  _drawLeaves(put);
  _drawWater(put);
  _drawPath(put);
  _drawColoredBlocks(put);
  _drawCobblestone(put);
  _drawDoor(put);
  _drawTallGrass(put);
  _drawBirchLogTop(put);
  _drawBirchLogSide(put);
  _drawSpruceLogTop(put);
  _drawSpruceLogSide(put);
  _drawBirchLeaves(put);
  _drawSpruceLeaves(put);
  _drawBuckets(put);
  _drawOres(put);
  _drawGlass(put);

  ctx.putImageData(img, 0, 0);
  return canvas;
}

// UV rectangle for a tile index; Three.js UV origin is bottom-left
export function getUVs(tile) {
  const col = tile % COLS;
  const row = Math.floor(tile / COLS);
  return {
    u0:  col      / COLS,
    u1: (col + 1) / COLS,
    v0: 1 - (row + 1) / TOTAL_ROWS,
    v1: 1 -  row      / TOTAL_ROWS,
  };
}

// Canvas pixel rect for a tile — used to draw atlas tiles in 2D UI
export function getTileRect(tile) {
  return {
    sx: (tile % COLS) * T,
    sy: Math.floor(tile / COLS) * T,
    sw: T,
    sh: T,
  };
}

export function drawBlockIcon2D(ctx, atlas, def, S) {
  ctx.imageSmoothingEnabled = false;
  const src = getTileRect(def.top);
  ctx.drawImage(atlas, src.sx, src.sy, T, T, 0, 0, S, S);
}

export function drawDoorIcon2D(ctx, atlas, def, S) {
  ctx.imageSmoothingEnabled = false;
  const src = getTileRect(def.top);
  const w = Math.round(S * 0.46);
  const h = S - 2;
  const x = Math.round((S - w) / 2);
  ctx.drawImage(atlas, src.sx, src.sy, T, T, x, 1, w, h);
}

export function drawBlockIcon3D(ctx, atlas, def, S) {
  const sc = S / T;
  const top  = getTileRect(def.top);
  const side = getTileRect(def.side);

  function face(clipPts, transform, src, dark) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(clipPts[0][0], clipPts[0][1]);
    for (let i = 1; i < clipPts.length; i++) ctx.lineTo(clipPts[i][0], clipPts[i][1]);
    ctx.closePath();
    ctx.clip();

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(...transform);
    ctx.drawImage(atlas, src.sx, src.sy, T, T, 0, 0, T, T);
    ctx.restore();

    if (dark > 0) {
      ctx.fillStyle = `rgba(0,0,0,${dark})`;
      ctx.beginPath();
      ctx.moveTo(clipPts[0][0], clipPts[0][1]);
      for (let i = 1; i < clipPts.length; i++) ctx.lineTo(clipPts[i][0], clipPts[i][1]);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  face(
    [[0, S/4], [S/2, 0], [S, S/4], [S/2, S/2]],
    [sc/2, -sc/4, sc/2, sc/4, 0, S/4],
    top, 0
  );
  face(
    [[0, S/4], [S/2, S/2], [S/2, S], [0, 3*S/4]],
    [sc/2, sc/4, 0, sc/2, 0, S/4],
    side, 0.2
  );
  face(
    [[S/2, S/2], [S, S/4], [S, 3*S/4], [S/2, S]],
    [sc/2, -sc/4, 0, sc/2, S/2, S/2],
    side, 0.4
  );
}
