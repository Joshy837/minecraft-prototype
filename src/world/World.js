import * as THREE from 'three';
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT } from './Chunk.js';
import { Noise } from '../utils/noise.js';
import { BLOCK } from './blocks.js';
import { buildAtlas, getUVs, TILE } from '../utils/textureAtlas.js';
import { nearbyVillageCenters, applyVillage } from './Village.js';
import { placeOakTree, placeBirchTree, placeSpruceTree } from './treeUtils.js';
import { WaterSimulator } from './WaterSimulator.js';
import { SEA_LEVEL } from '../config.js';

export class World {
  constructor(scene, seed = 42) {
    this.scene       = scene;
    this.renderDist  = 8;
    this.chunks      = new Map();
    this.heightNoise = new Noise(seed);
    this.caveNoise   = new Noise(seed + 95);
    this.lakeNoise   = new Noise(seed + 31);
    this.biomeNoise  = new Noise(seed + 157);
    this.riverNoise  = new Noise(seed + 209);
    this.riverWarpX  = new Noise(seed + 275);
    this.riverWarpZ  = new Noise(seed + 341);
    this.treeNoise   = new Noise(seed + 419);

    this.water = new WaterSimulator(this);
    this._waterTime = 0;

    let atlas;
    try {
      atlas = buildAtlas();
    } catch (e) {
      throw new Error(`Texture atlas build failed (canvas API unavailable?): ${e.message}`);
    }
    this.atlasCanvas = atlas;
    const tex   = new THREE.CanvasTexture(atlas);
    tex.magFilter      = THREE.NearestFilter;
    tex.minFilter      = THREE.NearestFilter;
    tex.generateMipmaps = false;
    this.material = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, alphaTest: 0.5 });

    // Compute water tile bounds in atlas UV space for the animated shader
    const wUV = getUVs(TILE.WATER);
    const WATER_VERT = `
      attribute vec3 color;
      varying vec2 vUv;
      varying vec3 vColor;
      void main() {
        vUv    = uv;
        vColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    const WATER_FRAG = `
      uniform sampler2D map;
      uniform float uTime;
      uniform float uU0;
      uniform float uV0;
      uniform float uUW;
      uniform float uVH;
      uniform vec3 uAmbient;
      varying vec2 vUv;
      varying vec3 vColor;
      void main() {
        float lu = (vUv.x - uU0) / uUW;
        float lv = (vUv.y - uV0) / uVH;
        // scroll downward; fract wraps within the tile
        float sv = fract(lv - uTime * 0.12);
        // subtle horizontal shimmer
        float su = clamp(lu + sin(uTime * 0.3 + lv * 6.28) * 0.025, 0.01, 0.99);
        vec2 auv = vec2(uU0 + su * uUW, uV0 + sv * uVH);
        vec4 tex = texture2D(map, auv);
        // caustic ripple highlight
        float rip = sin(lu * 28.0 - uTime * 0.8) * sin(lv * 31.0 + uTime * 0.7);
        rip = pow(max(0.0, rip), 3.0) * 0.15;
        vec3 base = tex.rgb * vColor * uAmbient;
        base = mix(base, vec3(0.38, 0.62, 0.85), 0.35);
        vec3 col = base + vec3(rip * 0.3, rip * 0.6, rip);
        gl_FragColor = vec4(col, 0.68);
      }
    `;
    this._waterTime = 0;
    this.waterMaterial = new THREE.ShaderMaterial({
      uniforms: {
        map:      { value: tex },
        uTime:    { value: 0 },
        uU0:      { value: wUV.u0 },
        uV0:      { value: wUV.v0 },
        uUW:      { value: wUV.u1 - wUV.u0 },
        uVH:      { value: wUV.v1 - wUV.v0 },
        uAmbient: { value: new THREE.Vector3(1, 1, 1) },
      },
      vertexShader:   WATER_VERT,
      fragmentShader: WATER_FRAG,
      transparent: true,
      depthWrite:  false,
    });
  }

  _key(cx, cz) { return `${cx},${cz}`; }

  // Returns [r, g, b] multiplier (0–1) to tint grass/foliage for this world position.
  grassTint(wx, wz) {
    const b = this.biomeNoise.octave(wx / 180, wz / 180, 3, 0.5); // 0..1
    if (b > 0.62) return [0.82, 0.88, 0.78]; // spruce — slightly darker/cooler
    return [1, 1, 1]; // oak & birch — default tint
  }

  // Returns { depth, nearRiver }.
  // depth: blocks to carve downward (0 outside river).
  // nearRiver: true within a wider band used to extend dirt so no stone faces water.
  riverAt(wx, wz) {
    const wx2 = wx + this.riverWarpX.get(wx / 80, wz / 80) * 35;
    const wz2 = wz + this.riverWarpZ.get(wx / 80, wz / 80) * 35;
    const rv = Math.abs(this.riverNoise.octave(wx2 / 380, wz2 / 380, 2, 0.5));
    const CARVE_WIDTH = 0.18;
    const BANK_WIDTH  = 0.30; // wider — catches edge columns whose stone would face water
    const nearRiver = rv < BANK_WIDTH;
    if (rv >= CARVE_WIDTH) return { depth: 0, nearRiver };
    const t = 1 - rv / CARVE_WIDTH;
    return { depth: t * t * t * 18, nearRiver };
  }

  surfaceAt(wx, wz) {
    const n = (this.heightNoise.octave(wx / 128, wz / 128, 6, 0.55) + 1) / 2;
    return Math.floor(8 + n * 38);
  }

  highestSolidAt(wx, wz) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    this._getOrCreate(cx, cz);
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      if (this.isSolid(wx, y, wz)) return y;
    }
    return 0;
  }

  // Returns {x, y, z} of a land (non-water) spawn point near (ox, oz).
  findLandSpawn(ox = 0, oz = 0, maxRadius = 128) {
    for (let r = 0; r <= maxRadius; r += 1) {
      const candidates = r === 0
        ? [[ox, oz]]
        : (function() {
            const pts = [];
            for (let d = -r; d <= r; d++) {
              pts.push([ox + d, oz - r], [ox + d, oz + r]);
              if (Math.abs(d) < r) pts.push([ox - r, oz + d], [ox + r, oz + d]);
            }
            return pts;
          })();
      for (const [wx, wz] of candidates) {
        const y = this.highestSolidAt(wx, wz);
        if (!this.isWaterlike(wx, y, wz) && !this.isWaterlike(wx, y + 1, wz)) {
          return { x: wx + 0.5, y: y + 2, z: wz + 0.5 };
        }
      }
    }
    // Fallback: just use origin
    return { x: ox + 0.5, y: this.highestSolidAt(ox, oz) + 2, z: oz + 0.5 };
  }

  _getOrCreate(cx, cz) {
    const k = this._key(cx, cz);
    if (!this.chunks.has(k)) {
      const chunk = new Chunk(cx, cz, this);
      this._generate(chunk);
      this.chunks.set(k, chunk);
      for (const [dx, dz] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nb = this.chunks.get(this._key(cx + dx, cz + dz));
        if (nb) nb.dirty = true;
      }
    }
    return this.chunks.get(k);
  }

  _generate(chunk) {
    const { cx, cz } = chunk;
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const wx = cx * CHUNK_SIZE + x;
        const wz = cz * CHUNK_SIZE + z;
        const rawH = this.surfaceAt(wx, wz);

        // River carving: only carve land that sits above sea level
        const { depth: riverDip, nearRiver } = this.riverAt(wx, wz);
        const inRiver  = riverDip > 0 && rawH > SEA_LEVEL + 2;
        const h = inRiver
          ? Math.max(rawH - Math.round(riverDip), SEA_LEVEL - 4)
          : rawH;

        // Terrain fill
        for (let y = 0; y <= h && y < CHUNK_HEIGHT; y++) {
          let block;
          // Extend dirt deep enough that no stone faces are exposed at water level.
          // nearRiver covers a wider band than the carve zone to catch edge columns.
          const dirtDepth = nearRiver ? Math.max(6, h - (SEA_LEVEL - 2)) : 3;
          if (y === h) {
            if (inRiver && h <= SEA_LEVEL - 1) {
              block = BLOCK.DIRT;  // river bed: water sits on top
            } else if (!inRiver && h <= SEA_LEVEL) {
              block = BLOCK.SAND;  // ocean/lake floor
            } else if (h >= 44) {
              block = BLOCK.SNOW;
            } else {
              block = BLOCK.GRASS; // river banks and normal land: air above
            }
          } else if (y >= h - dirtDepth) {
            block = (!inRiver && h <= SEA_LEVEL) ? BLOCK.SAND : BLOCK.DIRT;
          } else {
            block = BLOCK.STONE;
          }
          chunk.data[chunk.idx(x, y, z)] = block;
        }

        // Cave carving
        for (let y = 2; y <= h && y < CHUNK_HEIGHT; y++) {
          const n = this.caveNoise.octave3d(wx / 48, y / 32, wz / 48, 3, 0.5);
          if (Math.abs(n) < 0.04) {
            chunk.data[chunk.idx(x, y, z)] = BLOCK.AIR;
          }
        }

        // Water fill: ocean columns + lake basins carved near sea level.
        // All water surfaces are fixed at SEA_LEVEL — no per-column variation.
        const lakeVal = this.lakeNoise.octave(wx / 120, wz / 120, 3, 0.6);
        const isLake  = h > SEA_LEVEL && h < SEA_LEVEL + 8 && lakeVal > 0;
        if (h <= SEA_LEVEL || isLake) {
          if (inRiver) {
            // River channel: terrain fill already laid sand/dirt bed — just top up with water.
            for (let y = h + 1; y <= SEA_LEVEL; y++) {
              chunk.data[chunk.idx(x, y, z)] = BLOCK.WATER;
            }
          } else {
            const basinFloor = isLake
              ? Math.max(1, SEA_LEVEL - Math.round(lakeVal * 5))
              : 0;
            // Carve basin below sea level and lay sand floor
            for (let y = basinFloor; y <= SEA_LEVEL; y++) {
              if (y <= h) chunk.data[chunk.idx(x, y, z)] = (y === basinFloor ? BLOCK.SAND : BLOCK.STONE);
            }
            // Fill water up to SEA_LEVEL
            for (let y = basinFloor + 1; y <= SEA_LEVEL; y++) {
              if (!chunk.data[chunk.idx(x, y, z)]) chunk.data[chunk.idx(x, y, z)] = BLOCK.WATER;
            }
            // Drain water into any cave directly below the basin floor
            for (let ly = basinFloor - 1; ly >= 1; ly--) {
              if (!chunk.data[chunk.idx(x, ly, z)]) chunk.data[chunk.idx(x, ly, z)] = BLOCK.WATER;
              else break;
            }
          }
        }

        // Trees on grass — biome determines species, elevation skews toward spruce
        if (h > SEA_LEVEL + 1 && h < 44 && chunk.data[chunk.idx(x, h, z)] === BLOCK.GRASS) {
          const roll = Math.abs(Math.sin(wx * 127.1 + wz * 311.7 + wx * wz * 0.5)) * 100;
          if (roll < 0.6) {
            // biomeVal in [0,1]: low=oak forest, mid=birch forest, high=taiga
            const biomeVal = this.biomeNoise.octave(wx / 180, wz / 180, 3, 0.5);
            const elevBias = (h - SEA_LEVEL) / (44 - SEA_LEVEL); // 0 at sea, 1 near snow
            const spruceVal = biomeVal * 0.7 + elevBias * 0.3;
            if (spruceVal > 0.62) placeSpruceTree(chunk, x, h + 1, z);
            else if (biomeVal > 0.38) placeBirchTree(chunk, x, h + 1, z);
            else placeOakTree(chunk, x, h + 1, z);
          }
        }

        // Tall grass: cluster-based — patch noise gates the zone, density roll fills within it
        if (h > SEA_LEVEL + 1 && h < 44 && h + 1 < CHUNK_HEIGHT
            && chunk.data[chunk.idx(x, h, z)] === BLOCK.GRASS
            && chunk.data[chunk.idx(x, h + 1, z)] === BLOCK.AIR) {
          const patch = this.heightNoise.octave(wx / 14, wz / 14, 2, 0.5); // patch shape, ~14-block blobs
          if (patch > 0.35) { // only the top ~32% of patch noise forms clusters
            const roll = Math.abs(Math.sin(wx * 19.7 + wz * 37.3 + 5.5)) * 100;
            if (roll < 55) chunk.data[chunk.idx(x, h + 1, z)] = BLOCK.TALL_GRASS;
          }
        }
      }
    }

    // Ore veins — placed after terrain+caves so veins only replace stone
    //              minY maxY veins len  rad
    this._placeOreVeins(chunk, BLOCK.COAL_ORE,      5, 63, 12,  7, 1.5);
    this._placeOreVeins(chunk, BLOCK.IRON_ORE,      5, 54,  8,  6, 1.3);
    this._placeOreVeins(chunk, BLOCK.GOLD_ORE,      2, 32,  3,  5, 1.2);
    this._placeOreVeins(chunk, BLOCK.LAPIS_ORE,     1, 32,  2,  5, 1.2);
    this._placeOreVeins(chunk, BLOCK.REDSTONE_ORE,  1, 16,  3,  6, 1.2);
    this._placeOreVeins(chunk, BLOCK.DIAMOND_ORE,   1, 15,  1,  4, 1.0);

    // Village structures override terrain
    for (const { vx, vz, rx, rz } of nearbyVillageCenters(cx, cz)) {
      applyVillage(chunk, vx, vz, rx, rz, this);
    }
  }

  _oreRand(seed) {
    let s = Math.imul((seed | 0) ^ ((seed | 0) >>> 13), 1274126177);
    return ((s ^ (s >>> 16)) >>> 0) / 0x100000000;
  }

  _placeOreVeins(chunk, oreId, minY, maxY, veinsPerChunk, veinLen, veinRad) {
    const { cx, cz } = chunk;
    // Unique seed per chunk+ore combination
    const base = (cx * 73856093 ^ cz * 19349663 ^ oreId * 83492791) >>> 0;
    const radSq = veinRad * veinRad;
    const ri = Math.ceil(veinRad);

    for (let i = 0; i < veinsPerChunk; i++) {
      // Deterministic start position inside this chunk
      let seed = this._oreRand(base + i * 1000);
      const lx = Math.floor(seed * CHUNK_SIZE);
      seed = this._oreRand(base + i * 1000 + 1);
      const ly = minY + Math.floor(seed * (maxY - minY + 1));
      seed = this._oreRand(base + i * 1000 + 2);
      const lz = Math.floor(seed * CHUNK_SIZE);

      const STEP_DIRS = [[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]];
      let vx = lx, vy = ly, vz = lz;

      for (let step = 0; step < veinLen; step++) {
        // Place a small sphere of ore at the current walk position
        for (let dy = -ri; dy <= ri; dy++) {
          for (let dx = -ri; dx <= ri; dx++) {
            for (let dz = -ri; dz <= ri; dz++) {
              if (dx * dx + dy * dy + dz * dz <= radSq) {
                const bx = vx + dx, by = vy + dy, bz = vz + dz;
                if (bx >= 0 && bx < CHUNK_SIZE && bz >= 0 && bz < CHUNK_SIZE && by >= 1 && by < CHUNK_HEIGHT) {
                  if (chunk.data[chunk.idx(bx, by, bz)] === BLOCK.STONE) {
                    chunk.data[chunk.idx(bx, by, bz)] = oreId;
                  }
                }
              }
            }
          }
        }
        // Random walk step
        seed = this._oreRand(base + i * 1000 + 10 + step);
        const [sdx, sdy, sdz] = STEP_DIRS[Math.floor(seed * 6)];
        vx += sdx;
        vy = Math.max(minY, Math.min(maxY, vy + sdy));
        vz += sdz;
      }
    }
  }

  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return 0;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.chunks.get(this._key(cx, cz));
    if (!chunk) return 0;
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.data[chunk.idx(lx, wy, lz)] ?? 0;
  }

  setBlock(wx, wy, wz, type) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.chunks.get(this._key(cx, cz));
    if (!chunk) return;
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    chunk.data[chunk.idx(lx, wy, lz)] = type;
    chunk.dirty = true;
    if (lx === 0)              this._markDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this._markDirty(cx + 1, cz);
    if (lz === 0)              this._markDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this._markDirty(cx, cz + 1);

    if (type !== BLOCK.WATER && type !== BLOCK.WATER_FLOWING) {
      this.water.clearAt(wx, wy, wz);
    }

    if (type === BLOCK.AIR || type === BLOCK.WATER || type === BLOCK.WATER_FLOWING) {
      this.water.wakeNeighbours(wx, wy, wz, type === BLOCK.AIR);
    }
  }

  _markDirty(cx, cz) {
    const c = this.chunks.get(this._key(cx, cz));
    if (c) c.dirty = true;
  }

  isSolid(wx, wy, wz) {
    const b = this.getBlock(wx, wy, wz);
    return b !== 0 && b !== BLOCK.WATER && b !== BLOCK.WATER_FLOWING && b !== BLOCK.TALL_GRASS
        && b !== BLOCK.DOOR_OPEN && b !== BLOCK.DOOR_OPEN_X && b !== BLOCK.DOOR_OPEN_N && b !== BLOCK.DOOR_OPEN_W;
  }

  isWaterlike(wx, wy, wz) {
    const b = this.getBlock(wx, wy, wz);
    return b === BLOCK.WATER || b === BLOCK.WATER_FLOWING;
  }

  addWaterSource(wx, wy, wz) {
    this.water.addSource(wx, wy, wz);
  }

  _onWaterSourceRemoved(wx, wy, wz) {
    this.water.onSourceRemoved(wx, wy, wz);
  }

  update(px, pz, dt = 0) {
    this._waterTime += dt;
    this.waterMaterial.uniforms.uTime.value = this._waterTime;
    const pcx = Math.floor(px / CHUNK_SIZE);
    const pcz = Math.floor(pz / CHUNK_SIZE);
    let rebuildsLeft = 3;

    for (let dz = -this.renderDist; dz <= this.renderDist; dz++) {
      for (let dx = -this.renderDist; dx <= this.renderDist; dx++) {
        if (dx * dx + dz * dz > this.renderDist * this.renderDist) continue;
        const chunk = this._getOrCreate(pcx + dx, pcz + dz);
        if (chunk.dirty && rebuildsLeft > 0) {
          chunk.buildMesh(this.scene, this.material, this.waterMaterial);
          rebuildsLeft--;
        }
      }
    }

    for (const [k, chunk] of this.chunks) {
      const [ccx, ccz] = k.split(',').map(Number);
      const distSq = (ccx - pcx) ** 2 + (ccz - pcz) ** 2;
      if (distSq > (this.renderDist + 2) ** 2) {
        if (chunk.mesh) {
          this.scene.remove(chunk.mesh);
          chunk.mesh.geometry.dispose();
          chunk.mesh = null;
        }
        if (chunk.waterMesh) {
          this.scene.remove(chunk.waterMesh);
          chunk.waterMesh.geometry.dispose();
          chunk.waterMesh = null;
        }
        if (chunk.grassMesh) {
          this.scene.remove(chunk.grassMesh);
          chunk.grassMesh.geometry.dispose();
          chunk.grassMesh = null;
        }
        this.chunks.delete(k);
      }
    }

    this.water.update(dt);
  }
}
