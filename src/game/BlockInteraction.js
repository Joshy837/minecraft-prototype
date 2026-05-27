import * as THREE from 'three';
import { BLOCK, BLOCK_DEF, isDoor, doorToggle } from '../world/blocks.js';
import { PLAYER_H, HALF_W } from '../player/Player.js';
import { DroppedItem } from '../world/DroppedItem.js';
import { spawnBlockBreak } from '../utils/particles.js';
import { buildCrackTextures } from '../utils/crackTexture.js';
import { CREATIVE_INITIAL_DELAY, CREATIVE_REPEAT_RATE, PLACE_INITIAL_DELAY, PLACE_REPEAT_RATE } from '../config.js';

export class BlockInteraction {
  constructor({ scene, world, player, controls, inventoryState, atlasCanvas, droppedItems }) {
    this._scene          = scene;
    this._world          = world;
    this._player         = player;
    this._controls       = controls;
    this._inventoryState = inventoryState;
    this._atlasCanvas    = atlasCanvas;
    this._droppedItems   = droppedItems;

    // Crack overlay
    this._crackTextures = buildCrackTextures();
    const crackMat = new THREE.MeshBasicMaterial({
      map: this._crackTextures[0],
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this._crackMat  = crackMat;
    this._crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.002, 1.002, 1.002), crackMat);
    this._crackMesh.visible = false;
    scene.add(this._crackMesh);
    this._crackStage = -1;

    // Block highlight
    const hlGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.005, 1.005, 1.005));
    const hlMat = new THREE.LineBasicMaterial({ color: 0x000000 });
    this.highlight = new THREE.LineSegments(hlGeo, hlMat);
    this.highlight.visible = false;
    scene.add(this.highlight);

    // Break/place state
    this._break              = null;
    this._lmbPrev            = false;
    this._creativeBreakCooldown = 0;
    this._rmbHeldTime        = 0;
    this._rmbPlaceCooldown   = 0;
  }

  // Returns { damaged: bool } so caller can trigger health effects
  update(dt, hit, selectedSlot) {
    if (!hit) {
      this.highlight.visible = false;
      this._resetBreak();
      this._lmbPrev = this._controls.held(0);
      return { damaged: false };
    }

    this.highlight.position.set(hit.pos.x + 0.5, hit.pos.y + 0.5, hit.pos.z + 0.5);
    this.highlight.visible = true;

    const { x: bx, y: by, z: bz } = hit.pos;
    const targetId  = this._world.getBlock(bx, by, bz);
    const targetDef = BLOCK_DEF[targetId];
    const lmbRising = this._controls.held(0) && !this._lmbPrev;

    const _breakBlock = () => {
      if (targetId === BLOCK.WATER) this._world._onWaterSourceRemoved(bx, by, bz);
      this._world.setBlock(bx, by, bz, 0);
      if (isDoor(targetId)) {
        if (isDoor(this._world.getBlock(bx, by + 1, bz))) this._world.setBlock(bx, by + 1, bz, 0);
        if (isDoor(this._world.getBlock(bx, by - 1, bz))) this._world.setBlock(bx, by - 1, bz, 0);
      }
      if (this._world.getBlock(bx, by + 1, bz) === BLOCK.TALL_GRASS) this._world.setBlock(bx, by + 1, bz, 0);
      if (targetDef?.drop && !this._player.creative) {
        this._droppedItems.push(new DroppedItem(this._scene, this._atlasCanvas, targetDef.drop, { x: bx, y: by, z: bz }));
      }
      spawnBlockBreak(this._scene, bx, by, bz, targetDef?.color);
    };

    if (this._player.creative) {
      if (!this._controls.held(0)) {
        this._creativeBreakCooldown = 0;
      } else if (lmbRising) {
        if (targetDef && isFinite(targetDef.hardness)) _breakBlock();
        this._creativeBreakCooldown = CREATIVE_INITIAL_DELAY;
      } else {
        this._creativeBreakCooldown -= dt;
        if (this._creativeBreakCooldown <= 0 && targetDef && isFinite(targetDef.hardness)) {
          _breakBlock();
          this._creativeBreakCooldown = CREATIVE_REPEAT_RATE;
        }
      }
      this._resetBreak();
    } else if (this._controls.held(0) && targetDef && isFinite(targetDef.hardness)) {
      if (!this._break || this._break.x !== bx || this._break.y !== by || this._break.z !== bz) {
        this._break = { x: bx, y: by, z: bz, hardness: targetDef.hardness, progress: 0 };
      }
      this._break.progress += dt;
      const frac  = Math.min(this._break.progress / this._break.hardness, 1);
      const stage = Math.min(Math.floor(frac * 10), 9);
      if (stage !== this._crackStage) {
        this._crackStage = stage;
        this._crackMat.map = this._crackTextures[stage];
        this._crackMat.needsUpdate = true;
      }
      this._crackMesh.position.set(bx + 0.5, by + 0.5, bz + 0.5);
      this._crackMesh.visible = true;

      if (this._break.progress >= this._break.hardness) {
        this._crackMesh.visible = false;
        this._crackStage = -1;
        _breakBlock();
        this._resetBreak();
      }
    } else {
      this._resetBreak();
    }

    // Place (right-click + long-press repeat)
    const rmbHeld  = this._controls.held(2);
    const rmbClick = this._controls.consumeClick(2);
    if (!rmbHeld) {
      this._rmbHeldTime = 0;
      this._rmbPlaceCooldown = 0;
    } else {
      this._rmbHeldTime += dt;
      if (this._rmbPlaceCooldown > 0) this._rmbPlaceCooldown -= dt;
    }
    const shouldPlace = rmbClick || (rmbHeld && this._rmbHeldTime >= PLACE_INITIAL_DELAY && this._rmbPlaceCooldown <= 0);
    if (shouldPlace) {
      if (rmbHeld && !rmbClick) this._rmbPlaceCooldown = PLACE_REPEAT_RATE;
      this._handlePlace(hit, selectedSlot);
    }

    this._lmbPrev = this._controls.held(0);
    return { damaged: false };
  }

  endFrame() {
    this._lmbPrev = this._controls.held(0);
  }

  _handlePlace(hit, selectedSlot) {
    const hitBlock = this._world.getBlock(hit.pos.x, hit.pos.y, hit.pos.z);
    const selected = this._inventoryState.getHotbarBlock(selectedSlot);
    if (selected == null) return;

    if (selected === BLOCK.BUCKET && hitBlock === BLOCK.WATER) {
      const { x, y, z } = hit.pos;
      this._world._onWaterSourceRemoved(x, y, z);
      this._world.setBlock(x, y, z, 0);
      if (!this._player.creative) {
        const sl = this._inventoryState.slots[selectedSlot];
        if (sl?.count === 1) this._inventoryState.setSlotStack(selectedSlot, BLOCK.WATER_BUCKET, 1);
        else { this._inventoryState.consumeFromSlot(selectedSlot, 1); this._inventoryState.addItem(BLOCK.WATER_BUCKET, 1); }
      }
      return;
    }

    if (isDoor(hitBlock)) {
      const newState = doorToggle(hitBlock);
      this._world.setBlock(hit.pos.x, hit.pos.y, hit.pos.z, newState);
      if (isDoor(this._world.getBlock(hit.pos.x, hit.pos.y + 1, hit.pos.z))) this._world.setBlock(hit.pos.x, hit.pos.y + 1, hit.pos.z, newState);
      if (isDoor(this._world.getBlock(hit.pos.x, hit.pos.y - 1, hit.pos.z))) this._world.setBlock(hit.pos.x, hit.pos.y - 1, hit.pos.z, newState);
      return;
    }

    const { x, y, z } = hit.placePos;
    const px = this._player.pos.x, py = this._player.pos.y, pz = this._player.pos.z;
    const inside = x + 1 > px - HALF_W && x < px + HALF_W
                && y + 1 > py           && y < py + PLAYER_H
                && z + 1 > pz - HALF_W  && z < pz + HALF_W;
    if (inside) return;

    if (selected === BLOCK.WATER_BUCKET) {
      const targetBlock = this._world.getBlock(x, y, z);
      if (targetBlock === BLOCK.AIR || targetBlock === BLOCK.TALL_GRASS) {
        this._world.setBlock(x, y, z, BLOCK.WATER);
        this._world.addWaterSource(x, y, z);
        if (!this._player.creative) {
          const sl = this._inventoryState.slots[selectedSlot];
          if (sl?.count === 1) this._inventoryState.setSlotStack(selectedSlot, BLOCK.BUCKET, 1);
          else { this._inventoryState.consumeFromSlot(selectedSlot, 1); this._inventoryState.addItem(BLOCK.BUCKET, 1); }
        }
      }
    } else if (selected === BLOCK.BUCKET) {
      // nothing — bucket needs water to collect
    } else if (isDoor(selected)) {
      const a = ((this._controls.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      let blockToPlace;
      if      (a < Math.PI * 0.25 || a >= Math.PI * 1.75) blockToPlace = BLOCK.DOOR_CLOSED_N;
      else if (a < Math.PI * 0.75)                         blockToPlace = BLOCK.DOOR_CLOSED_W;
      else if (a < Math.PI * 1.25)                         blockToPlace = BLOCK.DOOR_CLOSED;
      else                                                  blockToPlace = BLOCK.DOOR_CLOSED_X;
      this._world.setBlock(x, y, z, blockToPlace);
      this._world.setBlock(x, y + 1, z, blockToPlace);
      if (!this._player.creative) this._inventoryState.consumeFromSlot(selectedSlot, 1);
    } else if (!BLOCK_DEF[selected]?.isItem) {
      this._world.setBlock(x, y, z, selected);
      if (selected === BLOCK.WATER) this._world.addWaterSource(x, y, z);
      if (!this._player.creative) this._inventoryState.consumeFromSlot(selectedSlot, 1);
    }
  }

  _resetBreak() {
    if (!this._break) return;
    this._break = null;
    this._crackMesh.visible = false;
    this._crackStage = -1;
  }
}
