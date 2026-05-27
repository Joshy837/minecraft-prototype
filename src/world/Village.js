import { BLOCK } from './blocks.js';
import { CHUNK_SIZE, CHUNK_HEIGHT } from './Chunk.js';

const REGION_SIZE  = 96;
const VILLAGE_RATE = 0.35;

function vrng(a, b, salt = 0) {
  const x = Math.sin(a * 127.1 + b * 311.7 + salt * 74.3) * 43758.5453;
  return x - Math.floor(x);
}

export function nearbyVillageCenters(cx, cz) {
  const wx0 = cx * CHUNK_SIZE, wz0 = cz * CHUNK_SIZE;
  const rx0 = Math.floor(wx0 / REGION_SIZE);
  const rz0 = Math.floor(wz0 / REGION_SIZE);
  const results = [];
  for (let rz = rz0 - 2; rz <= rz0 + 2; rz++) {
    for (let rx = rx0 - 2; rx <= rx0 + 2; rx++) {
      if (vrng(rx, rz, 0) > VILLAGE_RATE) continue;
      const vx = rx * REGION_SIZE + 5 + Math.floor(vrng(rx, rz, 1) * (REGION_SIZE - 10));
      const vz = rz * REGION_SIZE + 5 + Math.floor(vrng(rx, rz, 2) * (REGION_SIZE - 10));
      results.push({ vx, vz, rx, rz });
    }
  }
  return results;
}

export function applyVillage(chunk, vx, vz, rx, rz, world) {
  const h = world.surfaceAt(vx, vz);
  if (h < 18 || h > 37) return;

  const set = (wx, wy, wz, block) => {
    const lx = wx - chunk.cx * CHUNK_SIZE;
    const lz = wz - chunk.cz * CHUNK_SIZE;
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return;
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    chunk.data[chunk.idx(lx, wy, lz)] = block;
  };

  const themeColor = 11 + Math.floor(vrng(rx, rz, 20) * 16);

  _placePlaza(set, vx, vz, world, 4);
  _placeWell(set, vx, vz, h);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const lx = Math.round(vx + Math.cos(a) * 6);
    const lz = Math.round(vz + Math.sin(a) * 6);
    _placeLamppost(set, lx, lz, world.surfaceAt(lx, lz));
  }

  {
    const a = vrng(rx, rz, 30) * Math.PI * 2;
    const mx = Math.round(vx + Math.cos(a) * 14);
    const mz = Math.round(vz + Math.sin(a) * 14);
    const mh = world.surfaceAt(mx, mz);
    if (mh >= 18 && mh <= 37) {
      _placePath(set, vx, vz, mx, mz, world);
      _placeMarketStall(set, mx, mz, mh, themeColor);
    }
  }

  const numMain = 3 + Math.floor(vrng(rx, rz, 31) * 2);
  for (let i = 0; i < numMain; i++) {
    const a  = (i / numMain) * Math.PI * 2 + vrng(rx, rz + i, 32) * 0.6;
    const d  = 18 + Math.floor(vrng(rx + i, rz, 33) * 8);
    const bx = Math.round(vx + Math.cos(a) * d);
    const bz = Math.round(vz + Math.sin(a) * d);
    const bh = world.surfaceAt(bx, bz);
    if (bh < 18 || bh > 37) continue;
    _placePath(set, vx, vz, bx, bz, world);
    const t = Math.floor(vrng(rx + i, rz + 1, 34) * 3);
    if      (t === 0) _placeLargeHouse(set, bx, bz, bh, themeColor);
    else if (t === 1) _placeBarn(set, bx, bz, bh, themeColor);
    else              _placeMarketStall(set, bx, bz, bh, themeColor);
  }

  {
    const a  = vrng(rx, rz, 40) * Math.PI * 2;
    const d  = 26 + Math.floor(vrng(rx, rz, 41) * 7);
    const tx = Math.round(vx + Math.cos(a) * d);
    const tz = Math.round(vz + Math.sin(a) * d);
    const th = world.surfaceAt(tx, tz);
    if (th >= 18 && th <= 37) {
      _placePath(set, vx, vz, tx, tz, world);
      _placeWatchtower(set, tx, tz, th, themeColor);
    }
  }

  const numHouses = 4 + Math.floor(vrng(rx, rz, 50) * 4);
  for (let i = 0; i < numHouses; i++) {
    const a  = (i / numHouses) * Math.PI * 2 + vrng(rx, rz + i * 7, 51) * 0.9;
    const d  = 13 + Math.floor(vrng(rx + i, rz, 52) * 11);
    const hx = Math.round(vx + Math.cos(a) * d);
    const hz = Math.round(vz + Math.sin(a) * d);
    const hh = world.surfaceAt(hx, hz);
    if (hh < 18 || hh > 37) continue;
    const houseColor = 11 + Math.floor(vrng(rx + i, rz, 53) * 16);
    _placePath(set, vx, vz, hx, hz, world);
    _placeSmallHouse(set, hx, hz, hh, houseColor);
  }

  {
    const a  = vrng(rx, rz, 60) * Math.PI * 2;
    const d  = 28 + Math.floor(vrng(rx, rz, 61) * 9);
    const fx = Math.round(vx + Math.cos(a) * d);
    const fz = Math.round(vz + Math.sin(a) * d);
    const fh = world.surfaceAt(fx, fz);
    if (fh >= 18 && fh <= 37) {
      _placePath(set, vx, vz, fx, fz, world);
      _placeFarm(set, fx, fz, world);
    }
  }
}

// ─── Structure helpers ────────────────────────────────────────────────────────

function _placeWell(set, cx, cz, h) {
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dz === 0) {
        set(cx, h,     cz, BLOCK.WATER);
        set(cx, h + 1, cz, BLOCK.WATER);
      } else {
        set(cx + dx, h + 1, cz + dz, BLOCK.COBBLESTONE);
        set(cx + dx, h + 2, cz + dz, BLOCK.COBBLESTONE);
      }
    }
  }
  set(cx - 1, h + 3, cz, BLOCK.LOG);
  set(cx + 1, h + 3, cz, BLOCK.LOG);
  set(cx,     h + 3, cz, BLOCK.LOG);
  set(cx,     h + 3, cz - 1, BLOCK.LOG);
  set(cx,     h + 3, cz + 1, BLOCK.LOG);
}

function _placeLamppost(set, cx, cz, h) {
  set(cx, h + 1, cz, BLOCK.COBBLESTONE);
  set(cx, h + 2, cz, BLOCK.LOG);
  set(cx, h + 3, cz, BLOCK.LOG);
  set(cx, h + 4, cz, BLOCK.LOG);
  set(cx, h + 5, cz, BLOCK.YELLOW);
}

function _placePlaza(set, cx, cz, world, radius) {
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const ph = world.surfaceAt(cx + dx, cz + dz);
      set(cx + dx, ph,     cz + dz, BLOCK.PATH);
      set(cx + dx, ph - 1, cz + dz, BLOCK.PATH);
    }
  }
}

function _placePath(set, x1, z1, x2, z2, world) {
  const dx = x2 - x1, dz = z2 - z1;
  const steps = Math.max(Math.abs(dx), Math.abs(dz));
  if (steps === 0) return;
  const len = Math.hypot(dx, dz);
  const px = -dz / len, pz = dx / len;

  for (let i = 0; i <= steps; i++) {
    const t  = i / steps;
    const wx = Math.round(x1 + dx * t);
    const wz = Math.round(z1 + dz * t);
    for (let off = -1; off <= 1; off++) {
      const bx = Math.round(wx + px * off);
      const bz = Math.round(wz + pz * off);
      const bh = world.surfaceAt(bx, bz);
      set(bx, bh,     bz, BLOCK.PATH);
      set(bx, bh - 1, bz, BLOCK.PATH);
    }
  }
}

function _placeSmallHouse(set, cx, cz, h, color) {
  const W = 2; // 5×5 footprint
  // Cobblestone floor
  for (let dz = -W; dz <= W; dz++)
    for (let dx = -W; dx <= W; dx++)
      set(cx + dx, h, cz + dz, BLOCK.COBBLESTONE);
  // Cobblestone walls, 3 high
  for (let dz = -W; dz <= W; dz++) {
    for (let dx = -W; dx <= W; dx++) {
      if (Math.abs(dx) < W && Math.abs(dz) < W) continue;
      for (let dy = 1; dy <= 3; dy++)
        set(cx + dx, h + dy, cz + dz, BLOCK.COBBLESTONE);
    }
  }
  // Colored roof
  for (let dz = -W; dz <= W; dz++)
    for (let dx = -W; dx <= W; dx++)
      set(cx + dx, h + 4, cz + dz, color);
  // Clear interior
  for (let dz = -W + 1; dz <= W - 1; dz++)
    for (let dx = -W + 1; dx <= W - 1; dx++)
      for (let dy = 1; dy <= 3; dy++)
        set(cx + dx, h + dy, cz + dz, BLOCK.AIR);
  // Door on south face (2 blocks tall)
  set(cx, h + 1, cz + W, BLOCK.DOOR_CLOSED_N);
  set(cx, h + 2, cz + W, BLOCK.DOOR_CLOSED_N);
}

function _placeLargeHouse(set, cx, cz, h, color) {
  const W = 3; // 7×7 footprint
  // Cobblestone floor
  for (let dz = -W; dz <= W; dz++)
    for (let dx = -W; dx <= W; dx++)
      set(cx + dx, h, cz + dz, BLOCK.COBBLESTONE);
  // Cobblestone walls with color accent at dy=3
  for (let dz = -W; dz <= W; dz++) {
    for (let dx = -W; dx <= W; dx++) {
      if (Math.abs(dx) < W && Math.abs(dz) < W) continue;
      for (let dy = 1; dy <= 4; dy++) {
        const isAccent = dy === 3 && (Math.abs(dx) === W) !== (Math.abs(dz) === W);
        set(cx + dx, h + dy, cz + dz, isAccent ? color : BLOCK.COBBLESTONE);
      }
    }
  }
  // Colored roof
  for (let dz = -W; dz <= W; dz++)
    for (let dx = -W; dx <= W; dx++)
      set(cx + dx, h + 5, cz + dz, color);
  // LOG chimney on east face
  for (let dy = 1; dy <= 7; dy++)
    set(cx + W, h + dy, cz, BLOCK.LOG);
  // Clear interior
  for (let dz = -W + 1; dz <= W - 1; dz++)
    for (let dx = -W + 1; dx <= W - 1; dx++)
      for (let dy = 1; dy <= 4; dy++)
        set(cx + dx, h + dy, cz + dz, BLOCK.AIR);
  // 2-wide door on south face (2 blocks tall each, open space above)
  set(cx - 1, h + 1, cz + W, BLOCK.DOOR_CLOSED_N);
  set(cx,     h + 1, cz + W, BLOCK.DOOR_CLOSED_N);
  set(cx - 1, h + 2, cz + W, BLOCK.DOOR_CLOSED_N);
  set(cx,     h + 2, cz + W, BLOCK.DOOR_CLOSED_N);
  set(cx - 1, h + 3, cz + W, BLOCK.AIR);
  set(cx,     h + 3, cz + W, BLOCK.AIR);
}

function _placeWatchtower(set, cx, cz, h, color) {
  // 3×3 cobblestone walls, 10 high
  for (let dy = 1; dy <= 10; dy++) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const isWall = Math.abs(dx) === 1 || Math.abs(dz) === 1;
        if (dy <= 2 || isWall)
          set(cx + dx, h + dy, cz + dz, BLOCK.COBBLESTONE);
        else
          set(cx + dx, h + dy, cz + dz, BLOCK.AIR);
      }
    }
  }
  // 5×5 battle platform at h+11
  for (let dz = -2; dz <= 2; dz++)
    for (let dx = -2; dx <= 2; dx++)
      set(cx + dx, h + 11, cz + dz, BLOCK.COBBLESTONE);
  // Color crenellations
  const crenPos = [[-2,-2],[0,-2],[2,-2],[2,0],[2,2],[0,2],[-2,2],[-2,0]];
  for (const [dx, dz] of crenPos)
    set(cx + dx, h + 12, cz + dz, color);
  // Door on south face (2 blocks tall)
  set(cx, h + 1, cz + 1, BLOCK.DOOR_CLOSED_N);
  set(cx, h + 2, cz + 1, BLOCK.DOOR_CLOSED_N);
}

function _placeMarketStall(set, cx, cz, h, color) {
  const W = 3, D = 2;
  for (const [dx, dz] of [[-W, -D], [W, -D], [-W, D], [W, D]])
    for (let dy = 1; dy <= 4; dy++)
      set(cx + dx, h + dy, cz + dz, BLOCK.LOG);
  for (const dz of [-D, D])
    for (let dy = 1; dy <= 4; dy++)
      set(cx, h + dy, cz + dz, BLOCK.LOG);
  for (let dz = -D; dz <= D; dz++)
    for (let dx = -W; dx <= W; dx++)
      set(cx + dx, h + 5, cz + dz, color);
  for (let dx = -W; dx <= W; dx++)
    set(cx + dx, h + 5, cz, BLOCK.LOG);
  for (let dx = -W + 1; dx <= W - 1; dx++) {
    set(cx + dx, h + 1, cz - D, BLOCK.COBBLESTONE);
    set(cx + dx, h + 1, cz + D, BLOCK.COBBLESTONE);
  }
}

function _placeBarn(set, cx, cz, h, color) {
  const W = 4, D = 3;
  // Cobblestone floor
  for (let dz = -D; dz <= D; dz++)
    for (let dx = -W; dx <= W; dx++)
      set(cx + dx, h, cz + dz, BLOCK.COBBLESTONE);
  // LOG frame posts
  for (const px of [-W, 0, W]) {
    for (const pz of [-D, D]) {
      for (let dy = 1; dy <= 5; dy++)
        set(cx + px, h + dy, cz + pz, BLOCK.LOG);
    }
  }
  // LOG end walls
  for (let dz = -D; dz <= D; dz++)
    for (let dy = 1; dy <= 4; dy++) {
      set(cx - W, h + dy, cz + dz, BLOCK.LOG);
      set(cx + W, h + dy, cz + dz, BLOCK.LOG);
    }
  // Color fill long walls
  for (let dx = -W + 1; dx <= W - 1; dx++)
    for (let dy = 1; dy <= 4; dy++) {
      set(cx + dx, h + dy, cz - D, color);
      set(cx + dx, h + dy, cz + D, color);
    }
  // LOG roof and color ridge
  for (let dz = -D; dz <= D; dz++)
    for (let dx = -W; dx <= W; dx++)
      set(cx + dx, h + 6, cz + dz, BLOCK.LOG);
  for (let dx = -W; dx <= W; dx++)
    set(cx + dx, h + 7, cz, color);
  // Clear interior
  for (let dz = -D + 1; dz <= D - 1; dz++)
    for (let dx = -W + 1; dx <= W - 1; dx++)
      for (let dy = 1; dy <= 5; dy++)
        set(cx + dx, h + dy, cz + dz, BLOCK.AIR);
  // Door on south end (center, 2 blocks tall) with wide opening above
  set(cx, h + 1, cz + D, BLOCK.DOOR_CLOSED_N);
  set(cx, h + 2, cz + D, BLOCK.DOOR_CLOSED_N);
  for (let ddx = -1; ddx <= 1; ddx++) {
    if (ddx !== 0) set(cx + ddx, h + 2, cz + D, BLOCK.AIR);
    set(cx + ddx, h + 3, cz + D, BLOCK.AIR);
  }
}

function _placeFarm(set, cx, cz, world) {
  const W = 5, D = 4;
  for (let dz = -D; dz <= D; dz++) {
    for (let dx = -W; dx <= W; dx++) {
      const isEdge = Math.abs(dx) === W || Math.abs(dz) === D;
      const isPath = !isEdge && ((dx + W + 1) % 3 === 0);
      const bh = world.surfaceAt(cx + dx, cz + dz);
      if (isEdge) {
        set(cx + dx, bh + 1, cz + dz, BLOCK.COBBLESTONE);
      } else if (isPath) {
        set(cx + dx, bh,     cz + dz, BLOCK.PATH);
        set(cx + dx, bh - 1, cz + dz, BLOCK.PATH);
      } else {
        set(cx + dx, bh, cz + dz, BLOCK.DIRT);
      }
    }
  }
  // Entrance gap in south fence
  for (let ddx = -1; ddx <= 1; ddx++) {
    const bh = world.surfaceAt(cx + ddx, cz + D);
    set(cx + ddx, bh + 1, cz + D, BLOCK.AIR);
  }
}
