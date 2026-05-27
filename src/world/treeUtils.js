import { BLOCK } from './blocks.js';
import { CHUNK_SIZE, CHUNK_HEIGHT } from './Chunk.js';

export function placeOakTree(chunk, x, y, z) {
  for (let i = 0; i < 5; i++) {
    if (y + i < CHUNK_HEIGHT) chunk.data[chunk.idx(x, y + i, z)] = BLOCK.LOG;
  }
  const topY = y + 5;
  for (let ly = -2; ly <= 1; ly++) {
    const r = ly < 0 ? 2 : 1;
    for (let lx = -r; lx <= r; lx++) {
      for (let lz = -r; lz <= r; lz++) {
        if (lx === 0 && lz === 0 && ly >= 0) continue;
        const bx = x + lx, by = topY + ly, bz2 = z + lz;
        if (bx >= 0 && bx < CHUNK_SIZE && bz2 >= 0 && bz2 < CHUNK_SIZE && by >= 0 && by < CHUNK_HEIGHT) {
          if (!chunk.data[chunk.idx(bx, by, bz2)]) chunk.data[chunk.idx(bx, by, bz2)] = BLOCK.LEAVES;
        }
      }
    }
  }
  const oakTop = topY + 1;
  if (oakTop < CHUNK_HEIGHT && !chunk.data[chunk.idx(x, oakTop, z)]) {
    chunk.data[chunk.idx(x, oakTop, z)] = BLOCK.LEAVES;
  }
}

export function placeBirchTree(chunk, x, y, z) {
  const height = 7;
  for (let i = 0; i < height; i++) {
    if (y + i < CHUNK_HEIGHT) chunk.data[chunk.idx(x, y + i, z)] = BLOCK.BIRCH_LOG;
  }
  const topY = y + height;
  for (let ly = -2; ly <= 1; ly++) {
    const r = ly < 0 ? 2 : 1;
    for (let lx = -r; lx <= r; lx++) {
      for (let lz = -r; lz <= r; lz++) {
        if (lx === 0 && lz === 0 && ly >= 0) continue;
        const bx = x + lx, by = topY + ly, bz2 = z + lz;
        if (bx >= 0 && bx < CHUNK_SIZE && bz2 >= 0 && bz2 < CHUNK_SIZE && by >= 0 && by < CHUNK_HEIGHT) {
          if (!chunk.data[chunk.idx(bx, by, bz2)]) chunk.data[chunk.idx(bx, by, bz2)] = BLOCK.BIRCH_LEAVES;
        }
      }
    }
  }
  const birchTop = topY + 1;
  if (birchTop < CHUNK_HEIGHT && !chunk.data[chunk.idx(x, birchTop, z)]) {
    chunk.data[chunk.idx(x, birchTop, z)] = BLOCK.BIRCH_LEAVES;
  }
}

export function placeSpruceTree(chunk, x, y, z) {
  const height = 10;
  for (let i = 0; i < height; i++) {
    if (y + i < CHUNK_HEIGHT) chunk.data[chunk.idx(x, y + i, z)] = BLOCK.SPRUCE_LOG;
  }
  const layers = [
    { dy: 3, r: 3 }, { dy: 4, r: 3 }, { dy: 5, r: 2 },
    { dy: 6, r: 2 }, { dy: 7, r: 1 }, { dy: 8, r: 1 }, { dy: 9, r: 0 },
  ];
  for (const { dy, r } of layers) {
    const by = y + dy;
    if (by >= CHUNK_HEIGHT) continue;
    for (let lx = -r; lx <= r; lx++) {
      for (let lz = -r; lz <= r; lz++) {
        if (lx === 0 && lz === 0) continue;
        const bx = x + lx, bz2 = z + lz;
        if (bx >= 0 && bx < CHUNK_SIZE && bz2 >= 0 && bz2 < CHUNK_SIZE) {
          if (!chunk.data[chunk.idx(bx, by, bz2)]) chunk.data[chunk.idx(bx, by, bz2)] = BLOCK.SPRUCE_LEAVES;
        }
      }
    }
  }
  const topY = y + height;
  if (topY < CHUNK_HEIGHT && !chunk.data[chunk.idx(x, topY, z)]) {
    chunk.data[chunk.idx(x, topY, z)] = BLOCK.SPRUCE_LEAVES;
  }
}
