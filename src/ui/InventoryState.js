const MAX_STACK = 64;

export class InventoryState {
  // slots[0..8] = hotbar, slots[9..35] = main inventory
  constructor() {
    this.slots = new Array(36).fill(null);
    this.cursor = null; // { id, count } held by mouse
    this._listeners = [];
    this._notifying = false;
  }

  _notify() {
    if (this._notifying) return;
    this._notifying = true;
    for (const fn of this._listeners) fn();
    this._notifying = false;
  }

  addListener(fn) { this._listeners.push(fn); }

  getStack(i) { return this.slots[i]; }

  getHotbarBlock(slot) { return this.slots[slot]?.id ?? null; }

  addItem(id, count = 1) {
    for (let i = 0; i < 36 && count > 0; i++) {
      const s = this.slots[i];
      if (s?.id === id && s.count < MAX_STACK) {
        const take = Math.min(count, MAX_STACK - s.count);
        s.count += take; count -= take;
      }
    }
    for (let i = 0; i < 36 && count > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(count, MAX_STACK);
        this.slots[i] = { id, count: take }; count -= take;
      }
    }
    this._notify();
    return count; // leftover (inventory full)
  }

  consumeFromSlot(i, count = 1) {
    const s = this.slots[i];
    if (!s) return 0;
    const take = Math.min(count, s.count);
    s.count -= take;
    if (s.count <= 0) this.slots[i] = null;
    this._notify();
    return take;
  }

  setSlotStack(i, id, count) {
    this.slots[i] = (id != null && count > 0) ? { id, count } : null;
    this._notify();
  }

  clickSlot(i, shift = false) {
    if (shift) { this._shiftClick(i); return; }
    const s = this.slots[i], c = this.cursor;
    if (!c && !s) return;
    if (!c)       { this.cursor = { ...s }; this.slots[i] = null; }
    else if (!s)  { this.slots[i] = { ...c }; this.cursor = null; }
    else if (c.id === s.id && s.count < MAX_STACK) {
      const take = Math.min(c.count, MAX_STACK - s.count);
      s.count += take; c.count -= take;
      if (c.count <= 0) this.cursor = null;
    } else { this.slots[i] = { ...c }; this.cursor = { ...s }; }
    this._notify();
  }

  rightClickSlot(i) {
    const s = this.slots[i], c = this.cursor;
    if (!c && !s) return;
    if (!c) {
      const half = Math.ceil(s.count / 2);
      this.cursor = { id: s.id, count: half };
      s.count -= half;
      if (s.count <= 0) this.slots[i] = null;
    } else if (!s) {
      this.slots[i] = { id: c.id, count: 1 };
      if (--c.count <= 0) this.cursor = null;
    } else if (c.id === s.id && s.count < MAX_STACK) {
      s.count++;
      if (--c.count <= 0) this.cursor = null;
    } else { this.slots[i] = { ...c }; this.cursor = { ...s }; }
    this._notify();
  }

  _shiftClick(i) {
    const s = this.slots[i];
    if (!s) return;
    const [start, end] = i < 9 ? [9, 36] : [0, 9];
    let rem = s.count;
    for (let j = start; j < end && rem > 0; j++) {
      const d = this.slots[j];
      if (d?.id === s.id && d.count < MAX_STACK) {
        const take = Math.min(rem, MAX_STACK - d.count);
        d.count += take; rem -= take;
      }
    }
    for (let j = start; j < end && rem > 0; j++) {
      if (!this.slots[j]) {
        const take = Math.min(rem, MAX_STACK);
        this.slots[j] = { id: s.id, count: take }; rem -= take;
      }
    }
    s.count = rem;
    if (s.count <= 0) this.slots[i] = null;
    this._notify();
  }

  dropCursor() { this.cursor = null; this._notify(); }
}
