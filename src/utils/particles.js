import * as THREE from 'three';

const _active = [];
const _geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
const MAX_PARTICLES = 200;

export function spawnBlockBreak(scene, x, y, z, color) {
  const mat = new THREE.MeshBasicMaterial({ color: color ?? 0x888888 });
  const count = 5 + Math.floor(Math.random() * 3);

  for (let i = 0; i < count && _active.length < MAX_PARTICLES; i++) {
    const mesh = new THREE.Mesh(_geo, mat);
    mesh.position.set(
      x + 0.25 + Math.random() * 0.5,
      y + 0.25 + Math.random() * 0.5,
      z + 0.25 + Math.random() * 0.5
    );
    const speed = 0.8 + Math.random() * 1.2;
    const angle = Math.random() * Math.PI * 2;
    const upward = 0.5 + Math.random() * 1.2;
    const vx = Math.cos(angle) * speed;
    const vz = Math.sin(angle) * speed;
    scene.add(mesh);
    _active.push({ mesh, scene, vx, vy: upward, vz, life: 0.35 + Math.random() * 0.15 });
  }
}

export function updateParticles(dt) {
  for (let i = _active.length - 1; i >= 0; i--) {
    const p = _active[i];
    p.vy -= 18 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.life -= dt;
    if (p.life <= 0) {
      p.scene.remove(p.mesh);
      _active.splice(i, 1);
    }
  }
}
