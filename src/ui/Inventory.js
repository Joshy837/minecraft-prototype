import { BLOCK, BLOCK_DEF } from '../world/blocks.js';
import { drawBlockIcon3D, drawBlockIcon2D, drawDoorIcon2D } from '../utils/textureAtlas.js';

const CREATIVE_TABS = [
  { name: 'Building', ids: [BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.COBBLESTONE, BLOCK.SAND, BLOCK.GRAVEL, BLOCK.PATH, BLOCK.LOG, BLOCK.BIRCH_LOG, BLOCK.SPRUCE_LOG, BLOCK.GLASS, BLOCK.GLASS_PANE] },
  { name: 'Nature',   ids: [BLOCK.LEAVES, BLOCK.BIRCH_LEAVES, BLOCK.SPRUCE_LEAVES, BLOCK.TALL_GRASS, BLOCK.SNOW] },
  { name: 'Colors',   ids: [BLOCK.WHITE, BLOCK.ORANGE, BLOCK.MAGENTA, BLOCK.LIGHT_BLUE, BLOCK.YELLOW, BLOCK.LIME, BLOCK.PINK, BLOCK.GRAY, BLOCK.LIGHT_GRAY, BLOCK.CYAN, BLOCK.PURPLE, BLOCK.BLUE, BLOCK.BROWN, BLOCK.GREEN, BLOCK.RED, BLOCK.BLACK] },
  { name: 'Misc',     ids: [BLOCK.DOOR_CLOSED, BLOCK.BUCKET, BLOCK.WATER_BUCKET] },
];

export class Inventory {
  constructor(atlasCanvas, inventoryState) {
    this._atlas = atlasCanvas;
    this._state = inventoryState;
    this._creative = false;
    this._activeTab = 0;

    this._el = document.getElementById('inventory');
    this._cursorEl = document.getElementById('inv-cursor');
    this._tooltipEl = document.getElementById('inv-tooltip');
    this.onClose = null;

    this._state.addListener(() => this._refresh());
    this._bindGlobal();
  }

  set creative(v) { this._creative = v; }
  get creative()  { return this._creative; }

  // ── Build content ─────────────────────────────────────────────────────────
  _build() {
    this._el.innerHTML = '<div id="inv-panel"></div>';
    this._panel = document.getElementById('inv-panel');

    const closeBtn = this._el_('button', { class: 'inv-close-btn', text: '✕' });
    closeBtn.addEventListener('click', e => {
      e.stopPropagation();
      this._state.dropCursor();
      this.onClose?.();
    });
    this._panel.appendChild(closeBtn);

    if (this._creative) this._buildCreative();
    else                this._buildSurvival();
  }

  _buildSurvival() {
    // Title
    this._panel.appendChild(this._el_(
      'div', { class: 'inv-title', text: 'Inventory' }
    ));

    // Top row: armor+player model | crafting area
    const top = this._el_('div', { class: 'inv-top-row' });
    this._panel.appendChild(top);

    // -- Armor + player --
    const apArea = this._el_('div', { class: 'inv-armor-player' });
    top.appendChild(apArea);

    const armorCol = this._el_('div', { class: 'inv-armor-col' });
    const armorLabels = ['⛑', '🦺', '👖', '👟'];
    const armorNames  = ['Helmet', 'Chestplate', 'Leggings', 'Boots'];
    for (let i = 0; i < 4; i++) {
      const s = this._el_('div', { class: 'inv-slot inv-armor-slot', title: armorNames[i] });
      s.innerHTML = `<span class="inv-armor-icon">${armorLabels[i]}</span>`;
      armorCol.appendChild(s);
    }
    apArea.appendChild(armorCol);

    const model = this._el_('div', { class: 'inv-player-model' });
    model.innerHTML = '<span class="inv-player-figure">🧍</span>';
    apArea.appendChild(model);

    const offhandArea = this._el_('div', { class: 'inv-offhand-area' });
    const offhandSlot = this._el_('div', { class: 'inv-slot inv-armor-slot', title: 'Off-hand' });
    offhandSlot.innerHTML = '<span class="inv-armor-icon">🛡</span>';
    offhandArea.appendChild(offhandSlot);
    apArea.appendChild(offhandArea);

    // -- Crafting 2×2 + result --
    const crafting = this._el_('div', { class: 'inv-crafting' });
    top.appendChild(crafting);
    crafting.appendChild(this._el_('div', { class: 'inv-craft-label', text: 'Crafting' }));

    const craftRow = this._el_('div', { class: 'inv-craft-row' });
    crafting.appendChild(craftRow);

    const craftGrid = this._el_('div', { class: 'inv-craft-grid' });
    for (let i = 0; i < 4; i++) craftGrid.appendChild(this._makeSlot(null, 0, false));
    craftRow.appendChild(craftGrid);
    craftRow.appendChild(this._el_('div', { class: 'inv-craft-arrow', text: '▶' }));
    const result = this._makeSlot(null, 0, false);
    result.classList.add('inv-craft-result');
    craftRow.appendChild(result);

    // Main inventory (slots 9-35)
    this._panel.appendChild(this._el_('div', { class: 'inv-section-sep' }));
    const main = this._el_('div', { class: 'inv-grid-9' });
    this._panel.appendChild(main);
    for (let i = 9; i < 36; i++) {
      const s = this._state.getStack(i);
      const slot = this._makeSlot(s?.id ?? null, s?.count ?? 0, true);
      this._bindSlot(slot, i);
      main.appendChild(slot);
    }

    // Hotbar row
    this._panel.appendChild(this._el_('div', { class: 'inv-hotbar-sep' }));
    const hotbar = this._el_('div', { class: 'inv-grid-9 inv-hotbar-row' });
    this._panel.appendChild(hotbar);
    this._appendHotbarSlots(hotbar);
  }

  _buildCreative() {
    // Tabs
    const tabs = this._el_('div', { class: 'inv-tabs' });
    this._panel.appendChild(tabs);
    CREATIVE_TABS.forEach((tab, i) => {
      const btn = this._el_('button', { class: 'inv-tab' + (i === this._activeTab ? ' active' : ''), text: tab.name });
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._activeTab = i;
        this._build();
      });
      tabs.appendChild(btn);
    });

    // Block grid (current tab)
    const grid = this._el_('div', { class: 'inv-grid-9 inv-creative-grid' });
    this._panel.appendChild(grid);
    for (const id of CREATIVE_TABS[this._activeTab].ids) {
      const slot = this._makeSlot(id, 64, false);
      slot.classList.add('inv-creative-slot');
      slot.addEventListener('mousedown', e => {
        e.stopPropagation();
        if (e.button === 0) { this._state.cursor = { id, count: 64 }; this._state._notify(); }
      });
      grid.appendChild(slot);
    }

    // Separator + hotbar
    this._panel.appendChild(this._el_('div', { class: 'inv-hotbar-sep' }));
    const hotbar = this._el_('div', { class: 'inv-grid-9 inv-hotbar-row' });
    this._panel.appendChild(hotbar);
    this._appendHotbarSlots(hotbar);
  }

  _appendHotbarSlots(container) {
    for (let i = 0; i < 9; i++) {
      const s = this._state.getStack(i);
      const slot = this._makeSlot(s?.id ?? null, s?.count ?? 0, true);
      this._bindSlot(slot, i);
      container.appendChild(slot);
    }
  }

  _bindSlot(slot, i) {
    slot.addEventListener('mousedown', e => {
      e.stopPropagation();
      e.preventDefault();
      if (e.shiftKey)      this._state.clickSlot(i, true);
      else if (e.button === 0) this._state.clickSlot(i);
      else if (e.button === 2) this._state.rightClickSlot(i);
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  _el_(tag, { class: cls, text, title } = {}) {
    const el = document.createElement(tag);
    if (cls)   el.className   = cls;
    if (text)  el.textContent = text;
    if (title) el.title       = title;
    return el;
  }

  _drawIcon(ctx, def, S) {
    if (def.isItem || def.icon2D) drawBlockIcon2D(ctx, this._atlas, def, S);
    else if (def.isDoor)          drawDoorIcon2D(ctx, this._atlas, def, S);
    else                          drawBlockIcon3D(ctx, this._atlas, def, S);
  }

  _makeSlot(id, count, interactive) {
    const slot = document.createElement('div');
    slot.className = 'inv-slot' + (interactive ? '' : ' inv-slot-passive');
    if (id != null && BLOCK_DEF[id]) {
      const def = BLOCK_DEF[id];
      const ic = document.createElement('canvas');
      ic.width = ic.height = 32;
      ic.className = 'inv-icon';
      this._drawIcon(ic.getContext('2d'), def, 32);
      slot.appendChild(ic);
      if (count > 1) {
        const cnt = document.createElement('span');
        cnt.className = 'inv-count';
        cnt.textContent = count;
        slot.appendChild(cnt);
      }
      slot.addEventListener('mouseenter', () => {
        this._tooltipEl.textContent = def.name;
        this._tooltipEl.style.display = 'block';
      });
      slot.addEventListener('mouseleave', () => {
        this._tooltipEl.style.display = 'none';
      });
    }
    return slot;
  }

  // ── Refresh ───────────────────────────────────────────────────────────────
  _refresh() {
    if (!this.isOpen()) return;
    this._build();
    this._updateCursorEl();
  }

  _updateCursorEl() {
    const cur = this._state.cursor;
    if (cur?.id && BLOCK_DEF[cur.id]) {
      const def = BLOCK_DEF[cur.id];
      this._cursorEl.innerHTML = '';
      const ic = document.createElement('canvas');
      ic.width = ic.height = 32;
      ic.className = 'inv-icon';
      this._drawIcon(ic.getContext('2d'), def, 32);
      this._cursorEl.appendChild(ic);
      if (cur.count > 1) {
        const cnt = document.createElement('span');
        cnt.className = 'inv-count';
        cnt.textContent = cur.count;
        this._cursorEl.appendChild(cnt);
      }
      this._cursorEl.style.display = 'block';
    } else {
      this._cursorEl.style.display = 'none';
    }
  }

  // ── Global events ─────────────────────────────────────────────────────────
  _bindGlobal() {
    document.addEventListener('mousemove', e => {
      if (this.isOpen()) {
        this._cursorEl.style.left = (e.clientX - 20) + 'px';
        this._cursorEl.style.top  = (e.clientY - 20) + 'px';
        this._tooltipEl.style.left = (e.clientX + 14) + 'px';
        this._tooltipEl.style.top  = (e.clientY - 28) + 'px';
      }
    });

    this._el.addEventListener('mousedown', e => {
      if (e.target === this._el) {
        this._state.dropCursor();
        this.onClose?.();
      }
    });

    this._el.addEventListener('contextmenu', e => e.preventDefault());
  }

  // ── Public API ────────────────────────────────────────────────────────────
  open() {
    this._build();
    this._el.classList.add('open');
    this._updateCursorEl();
  }

  close() {
    this._state.dropCursor();
    this._el.classList.remove('open');
    this._cursorEl.style.display = 'none';
    this._tooltipEl.style.display = 'none';
  }

  isOpen() { return this._el.classList.contains('open'); }
}
