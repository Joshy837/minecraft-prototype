import * as THREE from 'three';
import { BLOCK, BLOCK_DEF } from '../world/blocks.js';
import { getPaneArms } from './glassPaneGeom.js';

// Returns {t, face} for the first intersection of ray with AABB, or null.
function rayAABB(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
  let txMin, txMax;
  if (dx !== 0) {
    txMin = (x0 - ox) / dx; txMax = (x1 - ox) / dx;
    if (txMin > txMax) { const s = txMin; txMin = txMax; txMax = s; }
  } else if (ox >= x0 && ox <= x1) { txMin = -Infinity; txMax = Infinity; }
  else return null;

  let tyMin, tyMax;
  if (dy !== 0) {
    tyMin = (y0 - oy) / dy; tyMax = (y1 - oy) / dy;
    if (tyMin > tyMax) { const s = tyMin; tyMin = tyMax; tyMax = s; }
  } else if (oy >= y0 && oy <= y1) { tyMin = -Infinity; tyMax = Infinity; }
  else return null;

  let tzMin, tzMax;
  if (dz !== 0) {
    tzMin = (z0 - oz) / dz; tzMax = (z1 - oz) / dz;
    if (tzMin > tzMax) { const s = tzMin; tzMin = tzMax; tzMax = s; }
  } else if (oz >= z0 && oz <= z1) { tzMin = -Infinity; tzMax = Infinity; }
  else return null;

  const tEnter = Math.max(txMin, tyMin, tzMin);
  const tExit  = Math.min(txMax, tyMax, tzMax);
  if (tEnter >= tExit || tExit <= 0) return null;

  let face;
  if (txMin >= tyMin && txMin >= tzMin) face = dx > 0 ? [-1, 0, 0] : [1, 0, 0];
  else if (tyMin >= tzMin)              face = dy > 0 ? [0, -1, 0] : [0, 1, 0];
  else                                  face = dz > 0 ? [0, 0, -1] : [0, 0, 1];

  return { t: tEnter, face };
}

export function raycast(getBlock, origin, direction, maxDist = 8) {
  const ox = origin.x, oy = origin.y, oz = origin.z;
  const dx = direction.x, dy = direction.y, dz = direction.z;

  let bx = Math.floor(ox);
  let by = Math.floor(oy);
  let bz = Math.floor(oz);

  const stepX = Math.sign(dx) || 1;
  const stepY = Math.sign(dy) || 1;
  const stepZ = Math.sign(dz) || 1;

  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;

  let tMaxX = dx !== 0 ? (stepX > 0 ? bx + 1 - ox : ox - bx) * tDeltaX : Infinity;
  let tMaxY = dy !== 0 ? (stepY > 0 ? by + 1 - oy : oy - by) * tDeltaY : Infinity;
  let tMaxZ = dz !== 0 ? (stepZ > 0 ? bz + 1 - oz : oz - bz) * tDeltaZ : Infinity;

  let face = [0, 0, 0];

  for (let i = 0; i < 128; i++) {
    const block = getBlock(bx, by, bz);
    if (block && !BLOCK_DEF[block]?.passable) {
      if (block === BLOCK.GLASS_PANE) {
        const { ns, ew } = getPaneArms(getBlock, bx, by, bz);
        const nsX0 = bx + ns.x0, nsX1 = bx + ns.x1;
        const nsZ0 = bz + ns.z0, nsZ1 = bz + ns.z1;
        const ewX0 = bx + ew.x0, ewX1 = bx + ew.x1;
        const ewZ0 = bz + ew.z0, ewZ1 = bz + ew.z1;

        const hitNS = rayAABB(ox, oy, oz, dx, dy, dz, nsX0, by, nsZ0, nsX1, by + 1, nsZ1);
        const hitEW = rayAABB(ox, oy, oz, dx, dy, dz, ewX0, by, ewZ0, ewX1, by + 1, ewZ1);

        let hit = null;
        if (hitNS && hitEW) hit = hitNS.t <= hitEW.t ? hitNS : hitEW;
        else hit = hitNS ?? hitEW;

        if (hit && hit.t < maxDist) {
          return {
            block,
            pos: new THREE.Vector3(bx, by, bz),
            face: hit.face,
            placePos: new THREE.Vector3(bx + hit.face[0], by + hit.face[1], bz + hit.face[2]),
          };
        }
        // Ray passed through the gap in the pane — continue DDA
      } else {
        return {
          block,
          pos: new THREE.Vector3(bx, by, bz),
          face,
          placePos: new THREE.Vector3(bx + face[0], by + face[1], bz + face[2]),
        };
      }
    }

    if (Math.min(tMaxX, tMaxY, tMaxZ) > maxDist) break;

    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      face = [-stepX, 0, 0];
      bx += stepX;
      tMaxX += tDeltaX;
    } else if (tMaxY < tMaxZ) {
      face = [0, -stepY, 0];
      by += stepY;
      tMaxY += tDeltaY;
    } else {
      face = [0, 0, -stepZ];
      bz += stepZ;
      tMaxZ += tDeltaZ;
    }
  }

  return null;
}
