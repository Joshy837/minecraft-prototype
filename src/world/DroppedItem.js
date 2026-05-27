import * as THREE from 'three';
import { getTileRect } from '../utils/textureAtlas.js';
import { BLOCK_DEF } from './blocks.js';

const GRAVITY      = -16;
const PICKUP_RADIUS = 1.5;
const PICKUP_DELAY  = 0.3;
const BOB_SPEED     = 2.2;
const BOB_AMP       = 0.07;
const SPIN_SPEED    = Math.PI * 0.35;

export class DroppedItem {
  constructor(scene, atlasCanvas, blockId, blockPos) {
    this.blockId = blockId;
    this.pos = new THREE.Vector3(blockPos.x + 0.5, blockPos.y + 0.7, blockPos.z + 0.5);
    this.vel = new THREE.Vector3(
      (Math.random() - 0.5) * 3,
      2.5 + Math.random() * 2,
      (Math.random() - 0.5) * 3
    );
    this.onGround = false;
    this._groundY  = 0;
    this._bobPhase = Math.random() * Math.PI * 2;
    this.age = 0;
    this._scene = scene;

    const def  = BLOCK_DEF[blockId];
    const SIZE = 64;

    const makeTex = (tile) => {
      const c = document.createElement('canvas');
      c.width = c.height = SIZE;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const { sx, sy, sw, sh } = getTileRect(tile);
      ctx.drawImage(atlasCanvas, sx, sy, sw, sh, 0, 0, SIZE, SIZE);
      const t = new THREE.CanvasTexture(c);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      return t;
    };

    // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
    const mats = [
      new THREE.MeshBasicMaterial({ map: makeTex(def.side) }),   // +X
      new THREE.MeshBasicMaterial({ map: makeTex(def.side) }),   // -X
      new THREE.MeshBasicMaterial({ map: makeTex(def.top)  }),   // +Y
      new THREE.MeshBasicMaterial({ map: makeTex(def.bottom) }), // -Y
      new THREE.MeshBasicMaterial({ map: makeTex(def.side) }),   // +Z
      new THREE.MeshBasicMaterial({ map: makeTex(def.side) }),   // -Z
    ];

    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), mats);
    this.mesh.position.copy(this.pos);
    scene.add(this.mesh);
  }

  // Returns true when the player is close enough to collect this item.
  update(dt, getBlock, playerPos) {
    this.age += dt;

    if (!this.onGround) {
      this.vel.y += GRAVITY * dt;
      this.pos.x += this.vel.x * dt;
      this.pos.y += this.vel.y * dt;
      this.pos.z += this.vel.z * dt;

      if (this.vel.y < 0) {
        const bx = Math.floor(this.pos.x);
        const by = Math.floor(this.pos.y - 0.18);
        const bz = Math.floor(this.pos.z);
        if (getBlock(bx, by, bz)) {
          this.pos.y    = by + 1 + 0.18;
          this._groundY = this.pos.y;
          this.vel.set(0, 0, 0);
          this.onGround = true;
        }
      }
    } else {
      const bx = Math.floor(this.pos.x);
      const by = Math.floor(this._groundY - 0.18);
      const bz = Math.floor(this.pos.z);
      if (!getBlock(bx, by, bz)) {
        this.onGround = false;
        this.vel.set(0, 0, 0);
      } else {
        this.pos.y = this._groundY + Math.sin(this.age * BOB_SPEED + this._bobPhase) * BOB_AMP;
      }
    }

    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y += SPIN_SPEED * dt;

    if (this.age > PICKUP_DELAY) {
      const dx = playerPos.x - this.pos.x;
      const dy = playerPos.y - this.pos.y;
      const dz = playerPos.z - this.pos.z;
      if (dx * dx + dy * dy + dz * dz < PICKUP_RADIUS * PICKUP_RADIUS) return true;
    }
    return false;
  }

  remove() {
    this._scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    for (const mat of this.mesh.material) {
      mat.map?.dispose();
      mat.dispose();
    }
  }
}
