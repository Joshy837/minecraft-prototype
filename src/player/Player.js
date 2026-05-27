import * as THREE from 'three';
import { CHUNK_HEIGHT } from '../world/Chunk.js';
import { BLOCK } from '../world/blocks.js';
import { getPaneArms } from '../utils/glassPaneGeom.js';

const GRAVITY    = -25;
const JUMP_VEL   =  8.5;
const SPEED      =  5;
const SPRINT_MUL =  1.6;
const SNEAK_MUL  =  0.3;
const SWIM_UP    =  4.0;
const FLY_SPEED  = 10;
const FLY_SPRINT =  1.5;
const PLAYER_H   =  1.8;
const PLAYER_W   =  0.6;
const HALF_W     =  PLAYER_W / 2;

export { PLAYER_H, HALF_W };

export class Player {
  constructor(camera, world) {
    this.camera      = camera;
    this.world       = world;
    this.pos         = new THREE.Vector3(0.5, 60, 0.5);
    this.vel         = new THREE.Vector3();
    this.grounded    = false;
    this.health      = 20;
    this.maxHealth   = 20;
    this._fallMaxY   = null;
    this._wasInWater = false;
    this._regenTimer    = 0;
    this._regenCooldown = 0;
    this.creative       = false;
    this.flying         = false;
    this._lastSpaceTap  = 0;
    this._spaceWasPressed = false;
  }

  update(dt, controls) {
    const wasGrounded = this.grounded;
    const isInWater   = this._isInWater();

    // Reset fall tracking when entering water so landing on water floor deals no damage
    if (isInWater && !this._wasInWater) this._fallMaxY = null;
    this._wasInWater = isInWater;

    if (controls.locked) {
      const spaceDown = controls.pressed('Space');

      // Double-tap Space in creative to toggle flying
      if (this.creative && spaceDown && !this._spaceWasPressed) {
        const now = performance.now();
        if (now - this._lastSpaceTap < 250) {
          this.flying = !this.flying;
          if (!this.flying) this.vel.y = 0;
        }
        this._lastSpaceTap = now;
      }
      this._spaceWasPressed = spaceDown;

      const sneak = controls.pressed('ShiftLeft');
      if (!controls.pressed('KeyW') || sneak) controls.sprinting = false;

      let mx = 0, mz = 0;
      if (controls.pressed('KeyW')) mz -= 1;
      if (controls.pressed('KeyS')) mz += 1;
      if (controls.pressed('KeyA')) mx -= 1;
      if (controls.pressed('KeyD')) mx += 1;

      if (this.flying) {
        const flyMul = controls.sprinting ? FLY_SPRINT : 1;
        const speed = FLY_SPEED * flyMul;
        if (mx !== 0 || mz !== 0) {
          const len = Math.hypot(mx, mz);
          mx /= len; mz /= len;
          const cos = Math.cos(controls.yaw);
          const sin = Math.sin(controls.yaw);
          this.vel.x = (cos * mx + sin * mz) * speed;
          this.vel.z = (-sin * mx + cos * mz) * speed;
        } else {
          this.vel.x = 0;
          this.vel.z = 0;
        }
        if (spaceDown)       this.vel.y =  FLY_SPEED;
        else if (sneak)      this.vel.y = -FLY_SPEED;
        else                 this.vel.y =  0;
      } else {
        const speedMul = isInWater ? 0.5 : controls.sprinting ? SPRINT_MUL : sneak ? SNEAK_MUL : 1;
        const speed = SPEED * speedMul;

        if (mx !== 0 || mz !== 0) {
          const len = Math.hypot(mx, mz);
          mx /= len; mz /= len;
          const cos = Math.cos(controls.yaw);
          const sin = Math.sin(controls.yaw);
          this.vel.x = (cos * mx + sin * mz) * speed;
          this.vel.z = (-sin * mx + cos * mz) * speed;
        } else {
          this.vel.x = 0;
          this.vel.z = 0;
        }

        if (isInWater) {
          if (spaceDown) {
            this.vel.y = this.grounded ? JUMP_VEL : SWIM_UP;
          } else {
            this.vel.y = Math.max(this.vel.y, -3);
          }
        } else if (spaceDown && this.grounded) {
          this.vel.y    = JUMP_VEL;
          this.grounded = false;
        }
      }
    }

    this.grounded = false;
    if (!this.flying) {
      const gravity = isInWater ? GRAVITY * 0.12 : GRAVITY;
      this.vel.y += gravity * dt;
      this.vel.y  = Math.max(this.vel.y, isInWater ? -3 : -50);
    }

    this._moveAxis('x', this.vel.x * dt);
    this._moveAxis('z', this.vel.z * dt);
    this._moveAxis('y', this.vel.y * dt);

    this.pos.y = Math.max(1, Math.min(CHUNK_HEIGHT - 2, this.pos.y));

    // Fall damage (Minecraft: floor(fallDist) - 3, not in water, not in creative)
    if (this.grounded) {
      if (!wasGrounded && this._fallMaxY !== null && !isInWater && !this.creative) {
        const fallDist = this._fallMaxY - this.pos.y;
        if (fallDist > 3) {
          this.damage(Math.floor(fallDist) - 3);
        }
      }
      this._fallMaxY = this.pos.y;
    } else {
      this._fallMaxY = this._fallMaxY === null ? this.pos.y : Math.max(this._fallMaxY, this.pos.y);
    }

    // Health regeneration: 1 HP every 4 s, with a 5 s cooldown after damage
    if (this.health > 0 && this.health < this.maxHealth) {
      this._regenCooldown = Math.max(0, this._regenCooldown - dt);
      if (this._regenCooldown === 0) {
        this._regenTimer -= dt;
        if (this._regenTimer <= 0) {
          this.health = Math.min(this.maxHealth, this.health + 1);
          this._regenTimer = 4;
        }
      }
    }

    const eyeX = this.pos.x;
    const eyeY = this.pos.y + PLAYER_H - 0.15;
    const eyeZ = this.pos.z;
    this.camera.rotation.order = 'YXZ';

    const p = controls.perspective;
    if (p === 0) {
      this.camera.position.set(eyeX, eyeY, eyeZ);
      this.camera.rotation.y = controls.yaw;
      this.camera.rotation.x = controls.pitch;
    } else {
      const DIST = 4.5;
      const sinY = Math.sin(controls.yaw);
      const cosY = Math.cos(controls.yaw);
      const cosPFwd = Math.cos(controls.pitch);
      const sinP    = Math.sin(controls.pitch);
      if (p === 1) {
        // Third-person back: pull camera behind and above
        this.camera.position.set(
          eyeX + sinY * cosPFwd * DIST,
          eyeY + sinP * DIST + 0.5,
          eyeZ + cosY * cosPFwd * DIST,
        );
        this.camera.rotation.y = controls.yaw;
        this.camera.rotation.x = controls.pitch;
      } else {
        // Third-person front: push camera in front, flip to face player
        this.camera.position.set(
          eyeX - sinY * cosPFwd * DIST,
          eyeY + sinP * DIST + 0.5,
          eyeZ - cosY * cosPFwd * DIST,
        );
        this.camera.rotation.y = controls.yaw + Math.PI;
        this.camera.rotation.x = -controls.pitch;
      }
    }
  }

  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    this._regenCooldown = 5;
    this._regenTimer    = 4;
  }

  _isInWater() {
    const x = Math.floor(this.pos.x);
    const z = Math.floor(this.pos.z);
    // Check mid-body height
    const b = this.world.getBlock(x, Math.floor(this.pos.y + 0.6), z);
    return b === BLOCK.WATER || b === BLOCK.WATER_FLOWING;
  }

  _moveAxis(axis, delta) {
    const before = this.pos[axis];
    this.pos[axis] += delta;
    const hit = this._resolveCollision(axis, delta);
    if (hit) {
      if (axis === 'y' && delta < 0) {
        this.grounded = true;
      } else if (axis !== 'y' && (this.grounded || this._isInWater()) && this.vel.y <= 0) {
        const savedY = this.pos.y;
        const pushedBack = this.pos[axis];
        this.pos.y += 1.0;
        this.pos[axis] = before + delta;
        if (!this._resolveCollision(axis, delta)) {
          this._moveAxis('y', -1.0);
          return;
        }
        this.pos[axis] = pushedBack;
        this.pos.y = savedY;
      }
      this.vel[axis] = 0;
    }
  }

  _resolveCollision(axis, delta) {
    const x0 = Math.floor(this.pos.x - HALF_W);
    const x1 = Math.floor(this.pos.x + HALF_W - 0.001);
    const y0 = Math.floor(this.pos.y);
    const y1 = Math.floor(this.pos.y + PLAYER_H - 0.001);
    const z0 = Math.floor(this.pos.z - HALF_W);
    const z1 = Math.floor(this.pos.z + HALF_W - 0.001);

    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) {
          const b = this.world.getBlock(x, y, z);
          if (b === BLOCK.GLASS_PANE) {
            if (this._resolvePaneCollision(x, y, z, axis, delta)) return true;
            continue;
          }
          if (!this.world.isSolid(x, y, z)) continue;
          if (axis === 'x') {
            this.pos.x = delta > 0 ? x - HALF_W : x + 1 + HALF_W;
            return true;
          }
          if (axis === 'y') {
            this.pos.y = delta < 0 ? y + 1 : y - PLAYER_H;
            return true;
          }
          if (axis === 'z') {
            this.pos.z = delta > 0 ? z - HALF_W : z + 1 + HALF_W;
            return true;
          }
        }
      }
    }
    return false;
  }

  _resolvePaneCollision(x, y, z, axis, delta) {
    const { ns, ew } = getPaneArms((bx, by, bz) => this.world.getBlock(bx, by, bz), x, y, z);
    const nsX0 = x + ns.x0, nsX1 = x + ns.x1;
    const nsZ0 = z + ns.z0, nsZ1 = z + ns.z1;
    const ewX0 = x + ew.x0, ewX1 = x + ew.x1;
    const ewZ0 = z + ew.z0, ewZ1 = z + ew.z1;

    const px0 = this.pos.x - HALF_W, px1 = this.pos.x + HALF_W;
    const pz0 = this.pos.z - HALF_W, pz1 = this.pos.z + HALF_W;

    const nsOverlap = px0 < nsX1 && px1 > nsX0 && pz0 < nsZ1 && pz1 > nsZ0;
    const ewOverlap = px0 < ewX1 && px1 > ewX0 && pz0 < ewZ1 && pz1 > ewZ0;

    if (!nsOverlap && !ewOverlap) return false;

    if (axis === 'y') {
      this.pos.y = delta < 0 ? y + 1 : y - PLAYER_H;
      return true;
    }
    if (axis === 'x') {
      if (nsOverlap) { this.pos.x = delta > 0 ? nsX0 - HALF_W : nsX1 + HALF_W; return true; }
      if (ewOverlap) { this.pos.x = delta > 0 ? ewX0 - HALF_W : ewX1 + HALF_W; return true; }
    }
    if (axis === 'z') {
      if (ewOverlap) { this.pos.z = delta > 0 ? ewZ0 - HALF_W : ewZ1 + HALF_W; return true; }
      if (nsOverlap) { this.pos.z = delta > 0 ? nsZ0 - HALF_W : nsZ1 + HALF_W; return true; }
    }
    return false;
  }
}
