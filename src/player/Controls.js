export class Controls {
  constructor(canvas) {
    this.locked      = false;
    this.yaw         = 0;
    this.pitch       = 0;
    this.sensitivity = 0.0022;
    this.keys        = new Set();
    this._clicks     = new Set();
    this._held       = new Set();
    this.onLockChange = null;
    this.sprinting   = false;
    this._lastWTap   = 0;
    // 0 = first-person, 1 = third-person back, 2 = third-person front
    this.perspective = 0;

    document.addEventListener('keydown', e => {
      this.keys.add(e.code);
      if (['Space','KeyW','KeyA','KeyS','KeyD','Tab'].includes(e.code)) e.preventDefault();
      if (e.code === 'F5') { e.preventDefault(); this.perspective = (this.perspective + 1) % 3; }
      if (e.code === 'KeyW') {
        const now = performance.now();
        if (now - this._lastWTap < 250) this.sprinting = true;
        this._lastWTap = now;
      }
      if (e.code === 'ShiftLeft') this.sprinting = false;
    });
    document.addEventListener('keyup',  e => this.keys.delete(e.code));
    window.addEventListener('blur',     () => { this.keys.clear(); this._held.clear(); });

    document.addEventListener('mousemove', e => {
      if (!this.locked) return;
      this.yaw   -= e.movementX * this.sensitivity;
      this.pitch  = Math.max(-1.5, Math.min(1.5, this.pitch - e.movementY * this.sensitivity));
    });

    document.addEventListener('mousedown', e => {
      if (this.locked) {
        this._clicks.add(e.button);
        this._held.add(e.button);
      }
    });
    document.addEventListener('mouseup',   e => this._held.delete(e.button));
    document.addEventListener('contextmenu', e => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.locked = !!document.pointerLockElement;
      if (!this.locked) this._held.clear();
      this.onLockChange?.(this.locked);
    });

    document.getElementById('pause-screen').addEventListener('click', e => {
      if (!this.locked && e.target === e.currentTarget) canvas.requestPointerLock();
    });
  }

  pressed(code)  { return this.keys.has(code); }
  held(btn)      { return this._held.has(btn); }

  consumeClick(btn) {
    if (!this._clicks.has(btn)) return false;
    this._clicks.delete(btn);
    return true;
  }
}
