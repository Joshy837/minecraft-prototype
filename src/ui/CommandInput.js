export class CommandInput {
  constructor() {
    this._el    = document.getElementById('command-input');
    this._input = document.getElementById('command-text');
    this._log   = document.getElementById('command-log');
    this.onCommand = null; // (rawText) => string | null
    this._open = false;

    this._input.addEventListener('keydown', e => {
      if (e.code === 'Enter') {
        e.preventDefault();
        this._submit();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        this.close();
      }
      e.stopPropagation();
    });

    this._input.addEventListener('keyup',  e => e.stopPropagation());
    this._input.addEventListener('keypress', e => e.stopPropagation());
  }

  get isOpen() { return this._open; }

  open(prefix = '') {
    this._open = true;
    this._el.style.display = 'flex';
    this._input.value = prefix;
    this._input.focus();
  }

  close() {
    this._open = false;
    this._el.style.display = 'none';
    this._input.value = '';
    this._input.blur();
  }

  _submit() {
    const raw = this._input.value.trim();
    if (!raw) { this.close(); return; }
    this._addLog('> ' + raw, '#aaa');
    if (this.onCommand) {
      const result = this.onCommand(raw);
      if (result) this._addLog(result, result.startsWith('Unknown') || result.startsWith('Usage') ? '#ff5555' : '#55ff55');
    }
    this.close();
  }

  _addLog(text, color = '#fff') {
    const line = document.createElement('div');
    line.className = 'cmd-log-line';
    line.textContent = text;
    line.style.color = color;
    this._log.appendChild(line);
    // Keep last 5 lines
    while (this._log.children.length > 5) this._log.removeChild(this._log.firstChild);
    // Auto-hide after 6 s
    clearTimeout(this._hideTimer);
    this._log.style.opacity = '1';
    this._hideTimer = setTimeout(() => { this._log.style.opacity = '0'; }, 6000);
  }
}
