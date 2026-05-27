import { BLOCK_DEF } from '../world/blocks.js';
import { drawBlockIcon3D, drawBlockIcon2D, drawDoorIcon2D } from '../utils/textureAtlas.js';

const H_SHAPE = [
  [0,1,1,0,1,1,0],
  [1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1],
  [0,1,1,1,1,1,0],
  [0,0,1,1,1,0,0],
  [0,0,0,1,0,0,0],
];
const H_PX  = 2;
const H_W   = 7 * H_PX;
const H_H   = 7 * H_PX;
const H_GAP = 3;

export class HUD {
  constructor(inventoryState, atlasCanvas, player, initialSkyTime = 0) {
    this._inventoryState = inventoryState;
    this._atlasCanvas    = atlasCanvas;
    this._player         = player;

    this.selectedSlot = 0;
    this.f3Open       = false;

    this._hotbarEl      = document.getElementById('hotbar');
    this._heartsEl      = document.getElementById('hearts');
    this._gamemodeLabel = document.getElementById('gamemode-label');
    this._f3El          = document.getElementById('f3');
    this._f3Left        = document.getElementById('f3-left');
    this._f3Right       = document.getElementById('f3-right');

    const labelEl = document.createElement('div');
    labelEl.id = 'hotbar-label';
    labelEl.style.cssText = 'position:fixed;bottom:110px;left:50%;transform:translateX(-50%);color:#fff;font-family:-apple-system,sans-serif;font-size:14px;text-shadow:0 1px 3px rgba(0,0,0,0.9);pointer-events:none;opacity:0;transition:opacity 0.15s;';
    document.body.appendChild(labelEl);
    this._hotbarLabel = labelEl;
    this._labelTimer  = null;

    this._fps = 0; this._fpsFrames = 0; this._fpsAccum = 0;
    this._gameDay     = 0;
    this._lastSkyTime = initialSkyTime;

    inventoryState.addListener(() => this.refreshHotbar());
    this.refreshHotbar();
    this.refreshHearts();
  }

  _makeBlockIcon(blockId, size) {
    const def = BLOCK_DEF[blockId];
    const ic  = document.createElement('canvas');
    ic.width = ic.height = size;
    ic.className = 'slot-icon';
    const ctx = ic.getContext('2d');
    if      (def.isItem || def.isTorch || def.icon2D) drawBlockIcon2D(ctx, this._atlasCanvas, def, size);
    else if (def.isDoor)                               drawDoorIcon2D(ctx, this._atlasCanvas, def, size);
    else                                               drawBlockIcon3D(ctx, this._atlasCanvas, def, size);
    return ic;
  }

  refreshHotbar() {
    this._hotbarEl.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const stack   = this._inventoryState.getStack(i);
      const blockId = stack?.id ?? null;
      const slot    = document.createElement('div');
      slot.className    = 'slot' + (i === this.selectedSlot ? ' active' : '');
      slot.style.position = 'relative';
      if (blockId != null && BLOCK_DEF[blockId]) {
        slot.appendChild(this._makeBlockIcon(blockId, 34));
        if (stack.count > 1) {
          const badge = document.createElement('div');
          badge.style.cssText = 'position:absolute;bottom:2px;right:3px;font-size:9px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.9);font-weight:700;font-family:-apple-system,sans-serif;';
          badge.textContent = stack.count;
          slot.appendChild(badge);
        }
      }
      slot.addEventListener('mousedown', () => this.selectSlot(i));
      this._hotbarEl.appendChild(slot);
    }
  }

  selectSlot(i) {
    this.selectedSlot = i;
    this._hotbarEl.querySelectorAll('.slot').forEach((s, idx) => s.classList.toggle('active', idx === i));
    const stack = this._inventoryState.getStack(i);
    const def   = stack?.id != null ? BLOCK_DEF[stack.id] : null;
    if (def) {
      this._hotbarLabel.textContent = def.name;
      this._hotbarLabel.style.opacity    = '1';
      this._hotbarLabel.style.transition = 'opacity 0.15s';
      if (this._labelTimer) clearTimeout(this._labelTimer);
      this._labelTimer = setTimeout(() => {
        this._hotbarLabel.style.transition = 'opacity 0.6s';
        this._hotbarLabel.style.opacity    = '0';
      }, 1200);
    } else {
      this._hotbarLabel.style.opacity = '0';
    }
  }

  refreshHearts() {
    this._heartsEl.style.display = this._player.creative ? 'none' : '';
    if (this._player.creative) return;
    const n = this._player.maxHealth / 2;
    this._heartsEl.width        = n * H_W + (n - 1) * H_GAP;
    this._heartsEl.height       = H_H + H_PX;
    this._heartsEl.style.width  = this._heartsEl.width  + 'px';
    this._heartsEl.style.height = this._heartsEl.height + 'px';
    const ctx = this._heartsEl.getContext('2d');
    ctx.clearRect(0, 0, this._heartsEl.width, this._heartsEl.height);

    for (let i = 0; i < n; i++) {
      const hp = Math.max(0, this._player.health - i * 2);
      const ox = i * (H_W + H_GAP);

      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      for (let r = 0; r < 7; r++)
        for (let c = 0; c < 7; c++)
          if (H_SHAPE[r][c])
            ctx.fillRect(ox + c * H_PX + H_PX, r * H_PX + H_PX, H_PX, H_PX);

      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (!H_SHAPE[r][c]) continue;
          const filled = hp >= 2 || (hp === 1 && c < 4);
          ctx.fillStyle = filled
            ? (r <= 1 ? '#ff6b6b' : '#ff3b30')
            : (r <= 1 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)');
          ctx.fillRect(ox + c * H_PX, r * H_PX, H_PX, H_PX);
        }
      }
    }
  }

  refreshGamemodeLabel() {
    if (!this._player.creative) {
      this._gamemodeLabel.style.display = 'none';
      return;
    }
    this._gamemodeLabel.style.display = 'block';
    this._gamemodeLabel.textContent   = this._player.flying ? 'Creative | Flying' : 'Creative';
  }

  toggleF3() {
    this.f3Open = !this.f3Open;
    this._f3El.classList.toggle('open', this.f3Open);
  }

  _f3Line(text, head = false) {
    if (!text) return `<div class="f3-line"> </div>`;
    const s = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<div class="f3-line${head ? ' f3-head' : ''}">${s}</div>`;
  }

  update(dt, player, sky, controls, world, dir) {
    this._fpsAccum += dt; this._fpsFrames++;
    if (this._fpsAccum >= 1) {
      this._fps = Math.round(this._fpsFrames / this._fpsAccum);
      this._fpsFrames = 0; this._fpsAccum = 0;
    }
    if (sky.time < this._lastSkyTime) this._gameDay++;
    this._lastSkyTime = sky.time;

    this.refreshGamemodeLabel();

    if (!this.f3Open) return;

    const { x, y, z } = player.pos;
    const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
    const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
    const icx = ((bx % 16) + 16) % 16;
    const icz = ((bz % 16) + 16) % 16;

    const absX = Math.abs(dir.x), absZ = Math.abs(dir.z);
    let facingH;
    if (absX > absZ) facingH = dir.x > 0 ? 'East  (+X)' : 'West  (-X)';
    else             facingH = dir.z > 0 ? 'South (+Z)' : 'North (-Z)';
    const yawDeg   = (controls.yaw   * 180 / Math.PI).toFixed(1);
    const pitchDeg = (controls.pitch * 180 / Math.PI).toFixed(1);

    this._f3Left.innerHTML = [
      ['minecraft-prototype', true],
      [`${this._fps} fps`],
      [''],
      [`XYZ:   ${x.toFixed(3)} / ${y.toFixed(3)} / ${z.toFixed(3)}`],
      [`Block: ${bx} / ${by} / ${bz}`],
      [`Chunk: ${icx} / ${by} / ${icz}  in  ${cx} / ${cz}`],
      [''],
      [`Facing: ${facingH}`],
      [`Rotation: ${yawDeg} / ${pitchDeg}`],
      [''],
      [`Time: ${sky.timeString()}  (day ${this._gameDay})`],
      [`Sky time: ${sky.time.toFixed(3)}`],
    ].map(([t = '', h = false]) => this._f3Line(t, h)).join('');

    const modeName = player.creative ? 'Creative' : 'Survival';
    this._f3Right.innerHTML = [
      [`Gamemode: ${modeName}`],
      player.creative ? [`Flying: ${player.flying}`] : [''],
      [''],
      [`Health: ${player.health} / ${player.maxHealth}`],
      [''],
      [`vel X: ${player.vel.x.toFixed(3)}`],
      [`vel Y: ${player.vel.y.toFixed(3)}`],
      [`vel Z: ${player.vel.z.toFixed(3)}`],
      [''],
      [`Grounded: ${player.grounded}`],
      [`In water: ${player._wasInWater}`],
      [`Sprinting: ${controls.sprinting}`],
      [''],
      ['Water', true],
      [`Queue:   ${world.water._waterQueue.length}  (+${world.water._waterNextTickQueue.length} deferred)`],
      [`Seen:    ${world.water._waterSeen.size}`],
      [`Sources: ${world.water._waterSources.size}`],
      [`Reset pending: ${world.water._waterResetPending}`],
    ].map(([t = '', h = false]) => this._f3Line(t, h)).join('');
  }
}
