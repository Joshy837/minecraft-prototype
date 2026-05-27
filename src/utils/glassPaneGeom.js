import { isPaneConnector } from '../world/blocks.js';

export const PANE_C = 7 / 16;
export const PANE_T = 2 / 16;

// Returns N-S and E-W arm extents in block-local [0..1] space.
// getBlock(x, y, z) => blockId must resolve world neighbours.
export function getPaneArms(getBlock, bx, by, bz) {
  const C0 = PANE_C, C1 = PANE_C + PANE_T;
  const cN = isPaneConnector(getBlock(bx,     by, bz - 1));
  const cS = isPaneConnector(getBlock(bx,     by, bz + 1));
  const cE = isPaneConnector(getBlock(bx + 1, by, bz));
  const cW = isPaneConnector(getBlock(bx - 1, by, bz));
  return {
    ns: { x0: C0,            x1: C1,            z0: cN ? 0 : C0, z1: cS ? 1 : C1 },
    ew: { x0: cW ? 0 : C0,  x1: cE ? 1 : C1,  z0: C0,           z1: C1          },
  };
}
