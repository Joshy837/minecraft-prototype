export class CommandHandler {
  constructor(sky, player, onGamemodeChange) {
    this._sky = sky;
    this._player = player;
    this._onGamemodeChange = onGamemodeChange;
  }

  handle(raw) {
    const parts = raw.replace(/^\//, '').trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();

    if (cmd === 'time') {
      if (parts[1] === 'set' && parts[2] !== undefined) {
        const NAMED = { day: 1000, noon: 6000, sunset: 12000, dusk: 12000, night: 13000, midnight: 18000, sunrise: 23000, dawn: 23000 };
        const raw2 = parts[2].toLowerCase();
        const ticks = Object.prototype.hasOwnProperty.call(NAMED, raw2) ? NAMED[raw2] : parseInt(raw2, 10);
        if (isNaN(ticks) || ticks < 0 || ticks > 24000) return 'Usage: /time set <0-24000 | day | noon | sunset | night | midnight | sunrise>';
        this._sky.time = ((ticks / 24000) + 0.25) % 1;
        return `Set time to ${ticks}`;
      }
      if (parts[1] === 'query') return `Time: ${this._sky.timeString()} (${Math.round(((this._sky.time - 0.25 + 1) % 1) * 24000)} ticks)`;
      return 'Usage: /time set <value>  |  /time query';
    }

    if (cmd === 'gamemode' || cmd === 'gm') {
      const mode = (parts[1] || '').toLowerCase();
      if (mode === 'creative' || mode === 'c' || mode === '1') {
        this._player.creative = true;
        this._onGamemodeChange();
        return 'Gamemode: Creative';
      }
      if (mode === 'survival' || mode === 's' || mode === '0') {
        this._player.creative = false;
        this._player.flying   = false;
        this._player.vel.y    = 0;
        this._onGamemodeChange();
        return 'Gamemode: Survival';
      }
      return 'Usage: /gamemode <survival|creative>';
    }

    if (cmd === 'tp') {
      const [x, y, z] = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
      if (isNaN(x) || isNaN(y) || isNaN(z)) return 'Usage: /tp <x> <y> <z>';
      this._player.pos.set(x, y, z);
      this._player.vel.set(0, 0, 0);
      return `Teleported to ${x} ${y} ${z}`;
    }

    return `Unknown command: ${parts[0]}`;
  }
}
