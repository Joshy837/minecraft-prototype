import { BLOCK } from './blocks.js';
import { WATER_TICK_INTERVAL } from '../config.js';

const MAX_QUEUE_SIZE = 8192;

export class WaterSimulator {
  constructor(world) {
    this._world = world;
    this._waterQueue         = [];
    this._waterNextTickQueue = [];
    this._waterSeen          = new Map(); // key => min level queued
    this._waterLevel         = new Map(); // key => flow level 0 (source) – 7 (thinnest)
    this._waterSources       = new Set(); // keys of all placed source blocks
    this._waterResetPending  = false;
    this._waterRemovalQueue  = [];
    this._tickAccum    = 0;
    this._tickInterval = WATER_TICK_INTERVAL;
  }

  addSource(wx, wy, wz) {
    const k = `${wx},${wy},${wz}`;
    this._waterSources.add(k);
    this._waterLevel.set(k, 0);
    this._queue(wx, wy, wz, 0);
  }

  onSourceRemoved(wx, wy, wz) {
    const k = `${wx},${wy},${wz}`;
    this._waterSources.delete(k);
    this._waterLevel.delete(k);
    this._scheduleReset();
  }

  clearAt(wx, wy, wz) {
    const k = `${wx},${wy},${wz}`;
    this._waterLevel.delete(k);
    this._waterSeen.delete(k);
  }

  wakeNeighbours(wx, wy, wz, immediate) {
    for (const [dx, dy, dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
      const nx = wx + dx, ny = wy + dy, nz = wz + dz;
      const nb = this._world.getBlock(nx, ny, nz);
      if (nb === BLOCK.WATER || nb === BLOCK.WATER_FLOWING) {
        const nk = `${nx},${ny},${nz}`;
        this._waterSeen.delete(nk);
        const lvl = this._waterLevel.get(nk) ?? (nb === BLOCK.WATER ? 0 : 7);
        if (immediate) this._queue(nx, ny, nz, lvl);
        else           this._defer(nx, ny, nz, lvl);
      }
    }
  }

  update(dt) {
    this._tickAccum += dt;
    if (this._tickAccum >= this._tickInterval) {
      this._tickAccum -= this._tickInterval;
      this._tick();
    }
  }

  _queue(wx, wy, wz, level) {
    if (this._waterQueue.length >= MAX_QUEUE_SIZE) return;
    const k = `${wx},${wy},${wz}`;
    const existing = this._waterSeen.get(k);
    if (existing !== undefined && existing <= level) return;
    this._waterSeen.set(k, level);
    this._waterQueue.push({ x: wx, y: wy, z: wz, level });
  }

  _defer(wx, wy, wz, level) {
    if (this._waterNextTickQueue.length >= MAX_QUEUE_SIZE) return;
    const k = `${wx},${wy},${wz}`;
    const existing = this._waterSeen.get(k);
    if (existing !== undefined && existing <= level) return;
    this._waterSeen.set(k, level);
    this._waterNextTickQueue.push({ x: wx, y: wy, z: wz, level });
  }

  _scheduleReset() {
    if (this._waterResetPending) return;
    this._waterResetPending = true;
    this._waterRemovalQueue = [];
    for (const k of this._waterLevel.keys()) {
      const [x, y, z] = k.split(',').map(Number);
      if (this._world.getBlock(x, y, z) === BLOCK.WATER_FLOWING) {
        const lvl = this._waterLevel.get(k) ?? 7;
        this._waterRemovalQueue.push({ k, lvl });
      }
    }
    this._waterRemovalQueue.sort((a, b) => b.lvl - a.lvl);
  }

  _tick() {
    if (this._waterNextTickQueue.length > 0) {
      this._waterQueue.push(...this._waterNextTickQueue);
      this._waterNextTickQueue = [];
    }

    if (this._waterResetPending) {
      const BATCH = 12;
      for (let i = 0; i < BATCH && this._waterRemovalQueue.length > 0; i++) {
        const { k } = this._waterRemovalQueue.shift();
        const [x, y, z] = k.split(',').map(Number);
        if (this._world.getBlock(x, y, z) === BLOCK.WATER_FLOWING) {
          this._world.setBlock(x, y, z, BLOCK.AIR);
        }
      }
      if (this._waterRemovalQueue.length === 0) {
        this._waterResetPending  = false;
        this._waterQueue         = [];
        this._waterNextTickQueue = [];
        this._waterSeen  = new Map();
        this._waterLevel = new Map();
        for (const k of this._waterSources) {
          const [x, y, z] = k.split(',').map(Number);
          if (this._world.getBlock(x, y, z) === BLOCK.WATER) {
            this._waterLevel.set(k, 0);
            this._queue(x, y, z, 0);
          } else {
            this._waterSources.delete(k);
          }
        }
      }
      return;
    }

    while (this._waterQueue.length > 0) {
      const { x, y, z, level } = this._waterQueue.shift();

      const b = this._world.getBlock(x, y, z);
      if (b !== BLOCK.WATER && b !== BLOCK.WATER_FLOWING) continue;

      const k = `${x},${y},${z}`;
      if ((this._waterLevel.get(k) ?? 9) < level) continue;

      if (b === BLOCK.WATER_FLOWING) {
        let adjSources = 0;
        for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          if (this._world.getBlock(x + dx, y, z + dz) === BLOCK.WATER) adjSources++;
        }
        const aboveIsSource = this._world.getBlock(x, y + 1, z) === BLOCK.WATER;
        if (adjSources >= 2 || (adjSources >= 1 && aboveIsSource)) {
          this._world.setBlock(x, y, z, BLOCK.WATER);
          this._waterSources.add(k);
          this._waterLevel.set(k, 0);
          this._queue(x, y, z, 0);
          continue;
        }
      }

      if (y > 0) {
        const below = this._world.getBlock(x, y - 1, z);
        if (below === BLOCK.AIR || below === BLOCK.TALL_GRASS) {
          const bk = `${x},${y - 1},${z}`;
          const existingBelow = this._waterLevel.get(bk) ?? 9;
          if (existingBelow > 8) {
            this._world.setBlock(x, y - 1, z, BLOCK.WATER_FLOWING);
            this._waterLevel.set(bk, 8);
            this._queue(x, y - 1, z, 8);
          }
          continue;
        }
      }

      const nextLevel = (level === 8) ? 1 : level + 1;
      if (nextLevel <= 7) {
        for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = x + dx, nz = z + dz;
          const nb = this._world.getBlock(nx, y, nz);
          if (nb === BLOCK.AIR || nb === BLOCK.TALL_GRASS || nb === BLOCK.WATER_FLOWING) {
            const nk = `${nx},${y},${nz}`;
            if ((this._waterLevel.get(nk) ?? 9) > nextLevel) {
              this._world.setBlock(nx, y, nz, BLOCK.WATER_FLOWING);
              this._waterLevel.set(nk, nextLevel);
              this._queue(nx, y, nz, nextLevel);
            }
          }
        }
      }
    }
  }
}
