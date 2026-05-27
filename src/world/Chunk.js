import * as THREE from 'three';
import { BLOCK_DEF, BLOCK } from './blocks.js';
import { getUVs, TILE, ATLAS_PIX_U, ATLAS_PIX_V } from '../utils/textureAtlas.js';
import { getPaneArms } from '../utils/glassPaneGeom.js';

export const CHUNK_SIZE   = 16;
export const CHUNK_HEIGHT = 64;

export const grassUniforms = { time: { value: 0 }, uAmbient: { value: new THREE.Color(1, 1, 1) } };

let _grassMat = null;
function getGrassMat(atlasTexture) {
  if (_grassMat) return _grassMat;
  _grassMat = new THREE.ShaderMaterial({
    uniforms: Object.assign(grassUniforms, { map: { value: atlasTexture } }),
    transparent: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    vertexShader: `
      attribute float swayAmt;
      attribute float swayPhase;
      attribute vec3 color;
      uniform float time;
      varying vec2 vUv;
      varying vec3 vColor;
      void main() {
        vUv = uv;
        vColor = color;
        vec3 pos = position;
        float disp = swayAmt * sin(time * 0.7 + swayPhase) * 0.12;
        pos.x += disp;
        pos.z += disp * 0.3;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform vec3 uAmbient;
      varying vec2 vUv;
      varying vec3 vColor;
      void main() {
        vec4 tex = texture2D(map, vUv);
        if (tex.a < 0.5) discard;
        vec3 amb = max(uAmbient, vec3(0.20, 0.28, 0.18));
        gl_FragColor = vec4(tex.rgb * vColor * amb, tex.a);
      }
    `,
  });
  return _grassMat;
}

// Door geometry table: [x0, z0, x1, z1] — the bounding box of the thin panel (y always 0..1)
const DT = 3 / 16;
const D1 = 1 - DT;
const DOOR_GEO = {
  [28]: [0,  0,  1,  DT], // DOOR_CLOSED   — panel at south (z=0..DT)
  [29]: [0,  0,  DT, 1 ], // DOOR_OPEN     — swung to east  (x=0..DT)
  [30]: [0,  0,  DT, 1 ], // DOOR_CLOSED_X — panel at west  (x=0..DT)
  [31]: [0,  0,  1,  DT], // DOOR_OPEN_X   — swung to south (z=0..DT)
  [32]: [0,  D1, 1,  1 ], // DOOR_CLOSED_N — panel at north (z=D1..1)
  [33]: [0,  0,  DT, 1 ], // DOOR_OPEN_N   — swung to east  (x=0..DT)
  [34]: [D1, 0,  1,  1 ], // DOOR_CLOSED_W — panel at east  (x=D1..1)
  [35]: [0,  0,  1,  DT], // DOOR_OPEN_W   — swung to south (z=0..DT)
};

// Each face: direction normal, 4 corner offsets (CCW from outside), brightness multiplier
// Top/bottom corners are reversed relative to sides so their normals point outward.
const FACES = [
  { dir: [ 1, 0, 0], corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], bright: 0.75 }, // +x
  { dir: [-1, 0, 0], corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]], bright: 0.75 }, // -x
  { dir: [ 0, 1, 0], corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], bright: 1.00 }, // +y top
  { dir: [ 0,-1, 0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], bright: 0.50 }, // -y bottom
  { dir: [ 0, 0, 1], corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]], bright: 0.85 }, // +z
  { dir: [ 0, 0,-1], corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]], bright: 0.85 }, // -z
];

// Per-face: [leftDir, rightDir, bottomDir, topDir] in the face's tangent plane.
// Derived from corner layout — used to trim glass border UVs against glass neighbors.
const FACE_PERP = [
  [[0,0,-1],[0,0, 1],[0,-1,0],[0,1,0]], // +x
  [[0,0, 1],[0,0,-1],[0,-1,0],[0,1,0]], // -x
  [[0,0, 1],[0,0,-1],[-1,0,0],[1,0,0]], // +y
  [[0,0,-1],[0,0, 1],[-1,0,0],[1,0,0]], // -y
  [[1,0, 0],[-1,0,0],[0,-1,0],[0,1,0]], // +z
  [[-1,0,0],[1,0, 0],[0,-1,0],[0,1,0]], // -z
];

export class Chunk {
  constructor(cx, cz, world) {
    this.cx    = cx;
    this.cz    = cz;
    this.world = world;
    this.data  = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    this.mesh      = null;
    this.waterMesh = null;
    this.grassMesh = null;
    this.dirty     = true;
  }

  idx(x, y, z) {
    return (y * CHUNK_SIZE + z) * CHUNK_SIZE + x;
  }

  getBlock(x, y, z) {
    if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
      return this.world.getBlock(this.cx * CHUNK_SIZE + x, y, this.cz * CHUNK_SIZE + z);
    }
    if (y < 0 || y >= CHUNK_HEIGHT) return 0;
    return this.data[this.idx(x, y, z)];
  }

  buildMesh(scene, material, waterMaterial) {
    const solid = { positions: [], uvs: [], colors: [], indices: [], vi: 0 };
    const water = { positions: [], uvs: [], colors: [], indices: [], vi: 0 };
    const grass = { positions: [], uvs: [], colors: [], indices: [], swayAmt: [], swayPhase: [], vi: 0 };

    this._collectGeometry(solid, water, grass);

    if (this.mesh)      { scene.remove(this.mesh);      this.mesh.geometry.dispose();      this.mesh      = null; }
    if (this.waterMesh) { scene.remove(this.waterMesh); this.waterMesh.geometry.dispose(); this.waterMesh = null; }
    if (this.grassMesh) { scene.remove(this.grassMesh); this.grassMesh.geometry.dispose(); this.grassMesh = null; }

    if (solid.vi > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(solid.positions, 3));
      geo.setAttribute('color',    new THREE.Float32BufferAttribute(solid.colors,    3));
      geo.setAttribute('uv',       new THREE.Float32BufferAttribute(solid.uvs,       2));
      geo.setIndex(solid.indices);
      this.mesh = new THREE.Mesh(geo, material);
      this.mesh.position.set(this.cx * CHUNK_SIZE, 0, this.cz * CHUNK_SIZE);
      scene.add(this.mesh);
    }

    if (water.vi > 0) {
      const wGeo = new THREE.BufferGeometry();
      wGeo.setAttribute('position', new THREE.Float32BufferAttribute(water.positions, 3));
      wGeo.setAttribute('color',    new THREE.Float32BufferAttribute(water.colors,    3));
      wGeo.setAttribute('uv',       new THREE.Float32BufferAttribute(water.uvs,       2));
      wGeo.setIndex(water.indices);
      this.waterMesh = new THREE.Mesh(wGeo, waterMaterial);
      this.waterMesh.position.set(this.cx * CHUNK_SIZE, 0, this.cz * CHUNK_SIZE);
      scene.add(this.waterMesh);
    }

    if (grass.vi > 0) {
      const gGeo = new THREE.BufferGeometry();
      gGeo.setAttribute('position',  new THREE.Float32BufferAttribute(grass.positions, 3));
      gGeo.setAttribute('color',     new THREE.Float32BufferAttribute(grass.colors,    3));
      gGeo.setAttribute('uv',        new THREE.Float32BufferAttribute(grass.uvs,       2));
      gGeo.setAttribute('swayAmt',   new THREE.Float32BufferAttribute(grass.swayAmt,   1));
      gGeo.setAttribute('swayPhase', new THREE.Float32BufferAttribute(grass.swayPhase, 1));
      gGeo.setIndex(grass.indices);
      this.grassMesh = new THREE.Mesh(gGeo, getGrassMat(material.map));
      this.grassMesh.position.set(this.cx * CHUNK_SIZE, 0, this.cz * CHUNK_SIZE);
      scene.add(this.grassMesh);
    }

    this.dirty = false;
  }

  _collectGeometry(solid, water, grass) {
    const aoMult = [0.5, 0.65, 0.8, 1.0];

    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const b = this.data[this.idx(x, y, z)];
          if (!b) continue;
          const def = BLOCK_DEF[b];
          if (!def) continue;

          if (b === BLOCK.TALL_GRASS) { this._addTallGrass(x, y, z, grass); continue; }
          if (b === BLOCK.GLASS_PANE) { this._addGlassPaneGeom(x, y, z, solid); continue; }
          if (DOOR_GEO[b])            { this._addDoorGeom(x, y, z, b, solid); continue; }

          this._addFaceGeom(x, y, z, b, def, solid, water, aoMult);
        }
      }
    }
  }

  _addTallGrass(x, y, z, g) {
    const { u0, u1, v0, v1 } = getUVs(TILE.TALL_GRASS);
    const wx = this.cx * CHUNK_SIZE + x;
    const wz = this.cz * CHUNK_SIZE + z;
    const r1 = Math.abs(Math.sin(wx * 127.3 + wz * 311.7));
    const r2 = Math.abs(Math.sin(wx * 73.1  + wz * 197.3));
    const r3 = Math.abs(Math.sin(wx * 53.9  + wz * 251.1));
    const H  = 0.45 + r1 * 0.35;
    const ox = (r2 - 0.5) * 0.18;
    const oz = (r3 - 0.5) * 0.18;
    const br = 1.3 + r1 * 0.15;
    const [tr, tg, tb] = this.world.grassTint(wx, wz);
    const phase = wx * 1.3 + wz * 0.9;
    const quads = [
      [[0.5+ox-0.3,0,0.5+oz-0.3],[0.5+ox-0.3,H,0.5+oz-0.3],[0.5+ox+0.3,H,0.5+oz+0.3],[0.5+ox+0.3,0,0.5+oz+0.3]],
      [[0.5+ox+0.3,0,0.5+oz-0.3],[0.5+ox+0.3,H,0.5+oz-0.3],[0.5+ox-0.3,H,0.5+oz+0.3],[0.5+ox-0.3,0,0.5+oz+0.3]],
    ];
    for (const q of quads) {
      for (const [qx, qy, qz] of q) {
        g.positions.push(x + qx, y + qy, z + qz);
        g.colors.push(br * tr, br * tg, br * tb);
        g.swayAmt.push(qy > 0 ? H : 0);
        g.swayPhase.push(phase);
      }
      g.uvs.push(u0, v0, u0, v1, u1, v1, u1, v0);
      g.indices.push(g.vi, g.vi+1, g.vi+2, g.vi, g.vi+2, g.vi+3);
      g.vi += 4;
      for (const [qx, qy, qz] of [...q].reverse()) {
        g.positions.push(x + qx, y + qy, z + qz);
        g.colors.push(br * tr, br * tg, br * tb);
        g.swayAmt.push(qy > 0 ? H : 0);
        g.swayPhase.push(phase);
      }
      g.uvs.push(u1, v0, u1, v1, u0, v1, u0, v0);
      g.indices.push(g.vi, g.vi+1, g.vi+2, g.vi, g.vi+2, g.vi+3);
      g.vi += 4;
    }
  }

  _addGlassPaneGeom(x, y, z, s) {
    const { u0, u1, v0, v1 } = getUVs(TILE.GLASS);
    const { ns, ew } = getPaneArms(this.getBlock.bind(this), x, y, z);
    const addFace = (pts, br) => {
      for (const [px2, py2, pz2] of pts) { s.positions.push(x + px2, y + py2, z + pz2); s.colors.push(br, br, br); }
      s.uvs.push(u0, v0, u0, v1, u1, v1, u1, v0);
      s.indices.push(s.vi, s.vi+1, s.vi+2, s.vi, s.vi+2, s.vi+3); s.vi += 4;
    };
    addFace([[ns.x0,0,ns.z1],[ns.x0,1,ns.z1],[ns.x0,1,ns.z0],[ns.x0,0,ns.z0]], 0.75);
    addFace([[ns.x1,0,ns.z0],[ns.x1,1,ns.z0],[ns.x1,1,ns.z1],[ns.x1,0,ns.z1]], 0.75);
    addFace([[ns.x0,1,ns.z1],[ns.x1,1,ns.z1],[ns.x1,1,ns.z0],[ns.x0,1,ns.z0]], 1.00);
    addFace([[ns.x0,0,ns.z0],[ns.x1,0,ns.z0],[ns.x1,0,ns.z1],[ns.x0,0,ns.z1]], 0.50);
    addFace([[ew.x0,0,ew.z0],[ew.x0,1,ew.z0],[ew.x1,1,ew.z0],[ew.x1,0,ew.z0]], 0.85);
    addFace([[ew.x1,0,ew.z1],[ew.x1,1,ew.z1],[ew.x0,1,ew.z1],[ew.x0,0,ew.z1]], 0.85);
    addFace([[ew.x0,1,ew.z1],[ew.x1,1,ew.z1],[ew.x1,1,ew.z0],[ew.x0,1,ew.z0]], 1.00);
    addFace([[ew.x0,0,ew.z0],[ew.x1,0,ew.z0],[ew.x1,0,ew.z1],[ew.x0,0,ew.z1]], 0.50);
  }

  _addDoorGeom(x, y, z, b, s) {
    const [x0, z0, x1, z1] = DOOR_GEO[b];
    const { u0, u1, v0, v1 } = getUVs(TILE.DOOR);
    const faces = [
      { fc: [[x1,0,z0],[x1,1,z0],[x1,1,z1],[x1,0,z1]], br: 0.75 },
      { fc: [[x0,0,z1],[x0,1,z1],[x0,1,z0],[x0,0,z0]], br: 0.75 },
      { fc: [[x0,1,z1],[x1,1,z1],[x1,1,z0],[x0,1,z0]], br: 1.00 },
      { fc: [[x0,0,z0],[x1,0,z0],[x1,0,z1],[x0,0,z1]], br: 0.50 },
      { fc: [[x1,0,z1],[x1,1,z1],[x0,1,z1],[x0,0,z1]], br: 0.85 },
      { fc: [[x0,0,z0],[x0,1,z0],[x1,1,z0],[x1,0,z0]], br: 0.85 },
    ];
    for (const { fc, br } of faces) {
      for (const [cx2, cy2, cz2] of fc) { s.positions.push(x + cx2, y + cy2, z + cz2); s.colors.push(br, br, br); }
      s.uvs.push(u0, v0, u0, v1, u1, v1, u1, v0);
      s.indices.push(s.vi, s.vi+1, s.vi+2, s.vi, s.vi+2, s.vi+3); s.vi += 4;
    }
  }

  _addFaceGeom(x, y, z, b, def, solid, water, aoMult) {
    const isWater = b === BLOCK.WATER || b === BLOCK.WATER_FLOWING;
    const isGlass = b === BLOCK.GLASS;
    const isGrass = b === BLOCK.GRASS;
    let gtR = 1, gtG = 1, gtB = 1;
    if (isGrass) {
      [gtR, gtG, gtB] = this.world.grassTint(this.cx * CHUNK_SIZE + x, this.cz * CHUNK_SIZE + z);
    }

    for (let f = 0; f < 6; f++) {
      const face = FACES[f];
      const [dx, dy, dz] = face.dir;
      const nb = this.getBlock(x + dx, y + dy, z + dz);

      if (isWater) {
        if (nb !== 0) continue;
      } else if (isGlass) {
        if (nb !== 0 && nb !== BLOCK.WATER && nb !== BLOCK.WATER_FLOWING && nb !== BLOCK.TALL_GRASS && nb !== BLOCK.GLASS_PANE && !DOOR_GEO[nb]) continue;
      } else {
        if (nb !== 0 && nb !== BLOCK.WATER && nb !== BLOCK.WATER_FLOWING && nb !== BLOCK.TALL_GRASS && nb !== BLOCK.GLASS && nb !== BLOCK.GLASS_PANE && !DOOR_GEO[nb]) continue;
      }

      const tile = f === 2 ? def.top : f === 3 ? def.bottom : def.side;
      let { u0, u1, v0, v1 } = getUVs(tile);
      if (isGlass) {
        const [ld, rd, bd, td] = FACE_PERP[f];
        if (this.getBlock(x+ld[0],y+ld[1],z+ld[2]) === BLOCK.GLASS) u0 += ATLAS_PIX_U;
        if (this.getBlock(x+rd[0],y+rd[1],z+rd[2]) === BLOCK.GLASS) u1 -= ATLAS_PIX_U;
        if (this.getBlock(x+bd[0],y+bd[1],z+bd[2]) === BLOCK.GLASS) v0 += ATLAS_PIX_V;
        if (this.getBlock(x+td[0],y+td[1],z+td[2]) === BLOCK.GLASS) v1 -= ATLAS_PIX_V;
      }
      const br = face.bright;

      if (isWater) {
        for (const [cx2, cy2, cz2] of face.corners) {
          const vy = cy2 === 1 ? this._waterCornerHeight(x, y, z, cx2, cz2) : cy2;
          water.positions.push(x + cx2, y + vy, z + cz2);
          water.colors.push(br, br, br);
        }
        water.uvs.push(u0, v0, u0, v1, u1, v1, u1, v0);
        water.indices.push(water.vi, water.vi+1, water.vi+2, water.vi, water.vi+2, water.vi+3);
        water.vi += 4;
      } else {
        const vertexAOs = [];
        for (const [cx2, cy2, cz2] of face.corners) {
          solid.positions.push(x + cx2, y + cy2, z + cz2);
          const nx = x + dx, ny = y + dy, nz = z + dz;
          let du1 = 0, dv1 = 0, dw1 = 0, du2 = 0, dv2 = 0, dw2 = 0;
          if (dx !== 0) {
            dv1 = cy2 === 1 ? 1 : -1; dw2 = cz2 === 1 ? 1 : -1;
          } else if (dy !== 0) {
            du1 = cx2 === 1 ? 1 : -1; dw2 = cz2 === 1 ? 1 : -1;
          } else {
            du1 = cx2 === 1 ? 1 : -1; dv2 = cy2 === 1 ? 1 : -1;
          }
          const aoSolid = (bk) => (bk && bk !== BLOCK.TALL_GRASS && bk !== BLOCK.GLASS && bk !== BLOCK.GLASS_PANE) ? 1 : 0;
          const s1 = aoSolid(this.getBlock(nx+du1, ny+dv1, nz+dw1));
          const s2 = aoSolid(this.getBlock(nx+du2, ny+dv2, nz+dw2));
          const co = aoSolid(this.getBlock(nx+du1+du2, ny+dv1+dv2, nz+dw1+dw2));
          const ao = (s1 && s2) ? 0 : 3 - (s1 + s2 + co);
          vertexAOs.push(ao);
          const finalBr = br * aoMult[ao];
          const applyTint = isGrass && tile === TILE.GRASS_TOP;
          solid.colors.push(finalBr * (applyTint ? gtR : 1), finalBr * (applyTint ? gtG : 1), finalBr * (applyTint ? gtB : 1));
        }
        solid.uvs.push(u0, v0, u0, v1, u1, v1, u1, v0);
        if (vertexAOs[0] + vertexAOs[2] < vertexAOs[1] + vertexAOs[3]) {
          solid.indices.push(solid.vi, solid.vi+1, solid.vi+3, solid.vi+1, solid.vi+2, solid.vi+3);
        } else {
          solid.indices.push(solid.vi, solid.vi+1, solid.vi+2, solid.vi, solid.vi+2, solid.vi+3);
        }
        solid.vi += 4;
      }
    }
  }

  _getWaterTopYAt(bx, by, bz) {
    const id = this.getBlock(bx, by, bz);
    if (id !== BLOCK.WATER && id !== BLOCK.WATER_FLOWING) return null;
    const wx = this.cx * CHUNK_SIZE + bx;
    const wz = this.cz * CHUNK_SIZE + bz;
    const lvl = this.world.water._waterLevel.get(`${wx},${by},${wz}`) ?? 0;
    return (lvl === 0 || lvl >= 8) ? 1.0 : (8 - lvl) / 8;
  }

  _waterCornerHeight(bx, by, bz, cx2, cz2) {
    let sum = 0, cnt = 0;
    for (const [ddx, ddz] of [[cx2-1,cz2-1],[cx2,cz2-1],[cx2-1,cz2],[cx2,cz2]]) {
      const nx = bx + ddx, nz = bz + ddz;
      const above = this.getBlock(nx, by + 1, nz);
      if (above === BLOCK.WATER || above === BLOCK.WATER_FLOWING) return 1.0;
      const h = this._getWaterTopYAt(nx, by, nz);
      if (h !== null) { sum += h; cnt++; }
    }
    return cnt > 0 ? sum / cnt : 1.0;
  }
}
