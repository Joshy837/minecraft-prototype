export const IS_MOBILE = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

const JOY_RADIUS  = 54;   // px, max stick travel from center
const JOY_BASE_SZ = JOY_RADIUS * 2 + 28; // outer ring diameter
const BREAK_DELAY = 320;  // ms hold-without-move to start breaking
const TAP_MAX_MS  = 220;  // ms — taps shorter than this trigger place
const TAP_MAX_PX  = 14;   // px — taps with less movement than this trigger place

export class MobileControls {
  constructor(controls, uiManager) {
    if (!IS_MOBILE) return;
    this._c  = controls;
    this._ui = uiManager;

    // per-touch state
    this._joy  = null; // { id, ox, oy }
    this._look = null; // { id, px, py, sx, sy, t0, moved, breaking, timer }

    this._buildDOM();
    this._bindJoystick();
    this._bindLook();
    this._bindButtons();
    this._watchModals();
    this._updatePauseHint();
  }

  // ─── DOM ────────────────────────────────────────────────────────────────────

  _buildDOM() {
    const style = document.createElement('style');
    style.textContent = `
      #mc {
        position: fixed; inset: 0; z-index: 10;
        pointer-events: none; touch-action: none;
        -webkit-user-select: none; user-select: none;
      }
      /* Left zone: joystick lives here */
      #mc-joy-zone {
        position: absolute; left: 0; top: 0; bottom: 0; width: 44%;
        pointer-events: auto; touch-action: none;
      }
      /* Right zone: look + place-on-tap */
      #mc-look-zone {
        position: absolute; right: 0; top: 0; bottom: 0; width: 56%;
        pointer-events: auto; touch-action: none;
        z-index: 1;
      }
      /* Floating joystick base (shown on touch) */
      #mc-joy-base {
        position: absolute; display: none;
        width: ${JOY_BASE_SZ}px; height: ${JOY_BASE_SZ}px;
        border-radius: 50%;
        background: rgba(255,255,255,0.10);
        border: 2.5px solid rgba(255,255,255,0.38);
        pointer-events: none;
        box-shadow: 0 0 20px rgba(0,0,0,0.25);
      }
      #mc-joy-stick {
        position: absolute; top: 50%; left: 50%;
        width: ${JOY_RADIUS}px; height: ${JOY_RADIUS}px;
        border-radius: 50%;
        background: rgba(255,255,255,0.38);
        border: 2.5px solid rgba(255,255,255,0.65);
        transform: translate(-50%, -50%);
        pointer-events: none;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      }
      /* Right-side action buttons */
      #mc-btns {
        position: absolute; right: 14px;
        bottom: max(24px, env(safe-area-inset-bottom, 0px));
        display: flex; flex-direction: column; gap: 10px;
        pointer-events: auto; z-index: 2;
        align-items: flex-end;
      }
      #mc-btns-row1, #mc-btns-row2 { display: flex; gap: 10px; }
      .mc-btn {
        width: 60px; height: 60px; border-radius: 50%;
        background: rgba(0,0,0,0.28);
        border: 2px solid rgba(255,255,255,0.35);
        color: #fff; font-size: 24px; font-weight: 700;
        display: flex; align-items: center; justify-content: center;
        pointer-events: auto; touch-action: manipulation;
        -webkit-user-select: none; user-select: none;
        cursor: pointer;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        transition: background 0.1s, transform 0.08s;
        box-shadow: 0 4px 14px rgba(0,0,0,0.4);
      }
      .mc-btn:active { background: rgba(255,255,255,0.28); transform: scale(0.91); }
      #mc-btn-break { background: rgba(180,50,30,0.32); border-color: rgba(255,120,90,0.55); font-size: 20px; }
      #mc-btn-break.active { background: rgba(255,80,40,0.6); }
      #mc-btn-jump  { background: rgba(30,120,220,0.32); border-color: rgba(100,180,255,0.55); }
      #mc-btn-sneak { background: rgba(140,110,30,0.32); border-color: rgba(220,190,80,0.55); font-size: 20px; }
      /* Inventory + pause buttons (left zone) */
      #mc-left-btns {
        position: absolute; left: 14px;
        bottom: max(24px, env(safe-area-inset-bottom, 0px));
        display: flex; gap: 10px;
        pointer-events: auto; z-index: 2;
        align-items: flex-end;
      }
      #mc-btn-inv   { background: rgba(80,60,160,0.32); border-color: rgba(160,130,255,0.55); font-size: 20px; }
      /* Pause button top-right */
      #mc-btn-pause {
        position: absolute;
        top: max(14px, env(safe-area-inset-top, 0px));
        right: 14px;
        width: 44px; height: 44px;
        border-radius: 14px;
        background: rgba(0,0,0,0.32);
        border: 1.5px solid rgba(255,255,255,0.28);
        color: rgba(255,255,255,0.85); font-size: 17px;
        display: flex; align-items: center; justify-content: center;
        pointer-events: auto; touch-action: manipulation;
        cursor: pointer; z-index: 2;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        box-shadow: 0 2px 10px rgba(0,0,0,0.35);
        -webkit-user-select: none; user-select: none;
      }
      #mc-btn-pause:active { background: rgba(255,255,255,0.2); }
      /* Sprint indicator near joystick */
      #mc-sprint-dot {
        position: absolute; bottom: 100%; left: 50%;
        transform: translateX(-50%);
        margin-bottom: 6px;
        width: 8px; height: 8px; border-radius: 50%;
        background: #30d158; opacity: 0;
        transition: opacity 0.15s;
        pointer-events: none;
      }
      #mc-joy-base.sprinting #mc-sprint-dot { opacity: 1; }
    `;
    document.head.appendChild(style);

    const el = document.createElement('div');
    el.id = 'mc';
    el.innerHTML = `
      <div id="mc-joy-zone">
        <div id="mc-joy-base">
          <div id="mc-joy-stick"></div>
          <div id="mc-sprint-dot"></div>
        </div>
      </div>
      <div id="mc-look-zone"></div>
      <div id="mc-left-btns">
        <div id="mc-btn-inv"   class="mc-btn" title="Inventory">☰</div>
      </div>
      <div id="mc-btns">
        <div id="mc-btns-row1">
          <div id="mc-btn-break" class="mc-btn" title="Break">⛏</div>
          <div id="mc-btn-jump"  class="mc-btn" title="Jump">⬆</div>
        </div>
        <div id="mc-btns-row2">
          <div id="mc-btn-sneak" class="mc-btn" title="Sneak">⬇</div>
        </div>
      </div>
      <div id="mc-btn-pause" title="Pause">⏸</div>
    `;
    document.body.appendChild(el);
  }

  // ─── Joystick ────────────────────────────────────────────────────────────────

  _bindJoystick() {
    const zone  = document.getElementById('mc-joy-zone');
    const base  = document.getElementById('mc-joy-base');
    const stick = document.getElementById('mc-joy-stick');
    const hw    = JOY_BASE_SZ / 2;

    zone.addEventListener('touchstart', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this._joy) continue;
        if (t.target.closest('.mc-btn')) continue;
        const r  = zone.getBoundingClientRect();
        const cx = t.clientX - r.left;
        const cy = t.clientY - r.top;
        const ox = Math.max(hw, Math.min(r.width  - hw, cx));
        const oy = Math.max(hw, Math.min(r.height - hw, cy));
        this._joy = { id: t.identifier, ox, oy };
        base.style.display = 'block';
        base.style.left    = `${ox - hw}px`;
        base.style.top     = `${oy - hw}px`;
        stick.style.transform = 'translate(-50%, -50%)';
      }
    }, { passive: false });

    zone.addEventListener('touchmove', e => {
      e.preventDefault();
      if (!this._joy) return;
      for (const t of e.changedTouches) {
        if (t.identifier !== this._joy.id) continue;
        const r   = zone.getBoundingClientRect();
        const rdx = (t.clientX - r.left) - this._joy.ox;
        const rdy = (t.clientY - r.top)  - this._joy.oy;
        const dist = Math.hypot(rdx, rdy);
        const clamped = Math.min(dist, JOY_RADIUS);
        const nx  = clamped > 0 ? (rdx / dist) * clamped : 0;
        const ny  = clamped > 0 ? (rdy / dist) * clamped : 0;

        stick.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;

        const normX = nx / JOY_RADIUS;
        const normY = ny / JOY_RADIUS;

        this._c.simulateKey('KeyW', normY < -0.3);
        this._c.simulateKey('KeyS', normY >  0.3);
        this._c.simulateKey('KeyA', normX < -0.3);
        this._c.simulateKey('KeyD', normX >  0.3);

        // Auto-sprint when joystick pushed hard forward
        const sprinting = normY < -0.80 && dist / JOY_RADIUS > 0.80;
        this._c.sprinting = sprinting;
        base.classList.toggle('sprinting', sprinting);
      }
    }, { passive: false });

    const endJoy = e => {
      if (!this._joy) return;
      for (const t of e.changedTouches) {
        if (t.identifier !== this._joy.id) continue;
        this._joy = null;
        base.style.display = 'none';
        base.classList.remove('sprinting');
        this._c.simulateKey('KeyW', false);
        this._c.simulateKey('KeyS', false);
        this._c.simulateKey('KeyA', false);
        this._c.simulateKey('KeyD', false);
        this._c.sprinting = false;
      }
    };
    zone.addEventListener('touchend',    endJoy, { passive: true });
    zone.addEventListener('touchcancel', endJoy, { passive: true });
  }

  // ─── Look zone ───────────────────────────────────────────────────────────────

  _bindLook() {
    const zone = document.getElementById('mc-look-zone');

    zone.addEventListener('touchstart', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this._look) continue;
        this._look = {
          id:   t.identifier,
          px: t.clientX, py: t.clientY,
          sx: t.clientX, sy: t.clientY,
          t0: performance.now(),
          moved: false, breaking: false,
          timer: setTimeout(() => {
            if (this._look && !this._look.moved) {
              this._look.breaking = true;
              this._c.simulateHeld(0, true);
            }
          }, BREAK_DELAY),
        };
      }
    }, { passive: false });

    zone.addEventListener('touchmove', e => {
      e.preventDefault();
      if (!this._look) return;
      for (const t of e.changedTouches) {
        if (t.identifier !== this._look.id) continue;
        const dx   = t.clientX - this._look.px;
        const dy   = t.clientY - this._look.py;
        const dist = Math.hypot(t.clientX - this._look.sx, t.clientY - this._look.sy);

        if (!this._look.moved && dist > TAP_MAX_PX) {
          this._look.moved = true;
          clearTimeout(this._look.timer);
          if (this._look.breaking) {
            this._look.breaking = false;
            this._c.simulateHeld(0, false);
          }
        }

        if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
          this._c.simulateMouseDelta(dx, dy);
        }
        this._look.px = t.clientX;
        this._look.py = t.clientY;
      }
    }, { passive: false });

    const endLook = e => {
      if (!this._look) return;
      for (const t of e.changedTouches) {
        if (t.identifier !== this._look.id) continue;
        clearTimeout(this._look.timer);
        if (this._look.breaking) {
          this._c.simulateHeld(0, false);
        } else if (!this._look.moved && performance.now() - this._look.t0 < TAP_MAX_MS) {
          this._c.simulateClick(2); // tap = place block
        }
        this._look = null;
      }
    };
    zone.addEventListener('touchend',    endLook, { passive: true });
    zone.addEventListener('touchcancel', endLook, { passive: true });
  }

  // ─── Buttons ─────────────────────────────────────────────────────────────────

  _bindButtons() {
    const c = this._c;

    const holdKey = (el, code) => {
      el.addEventListener('touchstart', e => {
        e.stopPropagation(); c.simulateKey(code, true);
      }, { passive: true });
      const up = e => { e.stopPropagation(); c.simulateKey(code, false); };
      el.addEventListener('touchend',    up, { passive: true });
      el.addEventListener('touchcancel', up, { passive: true });
    };

    holdKey(document.getElementById('mc-btn-jump'),  'Space');
    holdKey(document.getElementById('mc-btn-sneak'), 'ShiftLeft');

    const breakBtn = document.getElementById('mc-btn-break');
    breakBtn.addEventListener('touchstart', e => {
      e.stopPropagation();
      c.simulateHeld(0, true);
      breakBtn.classList.add('active');
    }, { passive: true });
    const releaseBreak = e => {
      e.stopPropagation();
      c.simulateHeld(0, false);
      breakBtn.classList.remove('active');
    };
    breakBtn.addEventListener('touchend',    releaseBreak, { passive: true });
    breakBtn.addEventListener('touchcancel', releaseBreak, { passive: true });

    document.getElementById('mc-btn-inv').addEventListener('touchstart', e => {
      e.stopPropagation();
      this._ui.toggleInventory();
    }, { passive: true });

    document.getElementById('mc-btn-pause').addEventListener('touchstart', e => {
      e.stopPropagation();
      this._ui.pause();
    }, { passive: true });
  }

  // ─── Modal awareness ─────────────────────────────────────────────────────────

  _watchModals() {
    const overlay = document.getElementById('mc');
    const update  = () => {
      const hidden = ['inventory', 'pause-screen', 'settings-modal'].some(id =>
        document.getElementById(id).classList.contains('open'),
      );
      overlay.style.display = hidden ? 'none' : '';
    };
    const obs = new MutationObserver(update);
    ['inventory', 'pause-screen', 'settings-modal'].forEach(id =>
      obs.observe(document.getElementById(id), { attributes: true, attributeFilter: ['class'] }),
    );
  }

  // Replace desktop-only pause screen hint with mobile hint
  _updatePauseHint() {
    const hint = document.querySelector('#pause-screen .hint');
    if (hint) {
      hint.innerHTML =
        'Left — Move &nbsp;|&nbsp; Right — Look<br>' +
        'Tap right — Place &nbsp;|&nbsp; ⛏ — Break &nbsp;|&nbsp; ⬆ — Jump<br>' +
        '⬇ — Sneak &nbsp;|&nbsp; ☰ — Inventory';
    }
  }
}
