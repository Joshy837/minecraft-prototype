export class UIManager {
  constructor({ renderer, controls, commandInput, inventory, player, hud, world }) {
    this._renderer     = renderer;
    this._controls     = controls;
    this._commandInput = commandInput;
    this._inventory    = inventory;
    this._player       = player;
    this._hud          = hud;
    this._world        = world;

    this.inventoryOpen      = false;
    this._pauseOpen         = false;
    this._settingsOpen      = false;
    this._closingInventory  = false;

    this._pauseScreen   = document.getElementById('pause-screen');
    this._settingsModal = document.getElementById('settings-modal');
    this._rdSlider      = document.getElementById('render-dist-slider');
    this._rdVal         = document.getElementById('render-dist-val');

    this._setupEvents();
  }

  _setupEvents() {
    this._controls.onLockChange = (locked) => {
      if (locked) {
        this._closingInventory = false;
      } else if (!this._closingInventory && !this.inventoryOpen && !this._pauseOpen && !this._settingsOpen && !this._commandInput.isOpen) {
        this._openPause();
      }
    };

    const origClose = this._commandInput.close.bind(this._commandInput);
    this._commandInput.close = () => {
      origClose();
      if (!this.inventoryOpen) this._renderer.domElement.requestPointerLock().catch(() => {});
    };

    this._inventory.onClose = () => this._closeInventory();

    this._rdSlider.addEventListener('input', () => {
      const v = parseInt(this._rdSlider.value, 10);
      this._rdVal.textContent = v;
      this._world.renderDist  = v;
    });
    document.getElementById('settings-close').addEventListener('click', () => this._closeSettings());
    this._settingsModal.addEventListener('mousedown', e => {
      if (e.target === this._settingsModal) this._closeSettings();
    });

    document.getElementById('pause-resume').addEventListener('click', () => this._closePause());
    document.getElementById('pause-settings').addEventListener('click', () => this._openSettings());

    document.addEventListener('keydown', e => this._onKeyDown(e));
    document.addEventListener('wheel', e => {
      if (this.inventoryOpen) return;
      const d = e.deltaY > 0 ? 1 : -1;
      this._hud.selectSlot((this._hud.selectedSlot + d + 9) % 9);
    }, { passive: true });
  }

  _onKeyDown(e) {
    if (this._commandInput.isOpen) return;

    if (e.code === 'F3') {
      e.preventDefault();
      this._hud.toggleF3();
      return;
    }
    if (e.code === 'KeyE') {
      e.preventDefault();
      if (this.inventoryOpen) this._closeInventory();
      else if (this._controls.locked) this._openInventory();
      return;
    }
    if (e.code === 'Escape') {
      if (this.inventoryOpen) { this._closeInventory(); return; }
      if (this._settingsOpen) { this._closeSettings();  return; }
      return;
    }
    if ((e.code === 'KeyT' || e.key === '/') && this._controls.locked && !this.inventoryOpen) {
      e.preventDefault();
      document.exitPointerLock();
      this._commandInput.open(e.key === '/' ? '/' : '');
      return;
    }
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9) this._hud.selectSlot(n - 1);
  }

  _openPause() {
    this._pauseOpen = true;
    this._pauseScreen.classList.add('open');
  }

  _closePause() {
    this._pauseOpen = false;
    this._pauseScreen.classList.remove('open');
    this._renderer.domElement.requestPointerLock().catch(() => this._openPause());
  }

  _openSettings() {
    this._settingsOpen     = true;
    this._rdSlider.value   = this._world.renderDist;
    this._rdVal.textContent = this._world.renderDist;
    this._settingsModal.classList.add('open');
  }

  _closeSettings() {
    this._settingsOpen = false;
    this._settingsModal.classList.remove('open');
  }

  _openInventory() {
    this.inventoryOpen         = true;
    this._inventory.creative   = this._player.creative;
    this._inventory.open();
    document.exitPointerLock();
  }

  _closeInventory() {
    this.inventoryOpen         = false;
    this._closingInventory     = true;
    this._inventory.close();
    this._renderer.domElement.requestPointerLock().catch(() => this._openPause());
  }
}
