import * as THREE from 'three';
import { headMats, torsoMats, armMats, legMats } from './steveSkin.js';

function box(w, h, d, mats, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
  mesh.position.set(x, y, z);
  return mesh;
}

export class PlayerBody {
  constructor(scene) {
    this.group = new THREE.Group();

    // Y values relative to player feet
    this.head  = box(0.50, 0.50, 0.50, headMats(),  0.00, 1.55,  0.00);
    this.torso = box(0.50, 0.70, 0.25, torsoMats(), 0.00, 0.95,  0.00);
    this.armL  = box(0.20, 0.70, 0.25, armMats(),   0.35, 0.95,  0.00);
    this.armR  = box(0.20, 0.70, 0.25, armMats(),  -0.35, 0.95,  0.00);
    this.legL  = box(0.22, 0.75, 0.25, legMats(),   0.13, 0.375, 0.00);
    this.legR  = box(0.22, 0.75, 0.25, legMats(),  -0.13, 0.375, 0.00);

    this._mats = [];
    for (const part of [this.head, this.torso, this.armL, this.armR, this.legL, this.legR]) {
      this.group.add(part);
      for (const m of part.material) this._mats.push(m);
    }

    this.group.visible = false;
    scene.add(this.group);
  }

  update(playerPos, yaw, perspective, dt, vel, ambient) {
    this.group.visible = perspective !== 0;
    if (!this.group.visible) return;

    this.group.position.copy(playerPos);
    this.group.rotation.y = yaw;

    if (ambient) {
      const [ar, ag, ab] = ambient;
      for (const m of this._mats) m.color.setRGB(ar, ag, ab);
    }

    const moving = vel && (Math.abs(vel.x) > 0.01 || Math.abs(vel.z) > 0.01);
    if (moving) {
      const t = performance.now() / 1000;
      const swing = Math.sin(t * 8) * 0.4;
      this.armL.rotation.x =  swing;
      this.armR.rotation.x = -swing;
      this.legL.rotation.x = -swing;
      this.legR.rotation.x =  swing;
    } else {
      this.armL.rotation.x = 0;
      this.armR.rotation.x = 0;
      this.legL.rotation.x = 0;
      this.legR.rotation.x = 0;
    }
  }

  dispose() {
    this.group.parent?.remove(this.group);
  }
}
