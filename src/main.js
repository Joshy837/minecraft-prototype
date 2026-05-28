import * as THREE from 'three';
import { World } from './world/World.js';
import { grassUniforms } from './world/Chunk.js';
import { Player } from './player/Player.js';
import { Controls } from './player/Controls.js';
import { raycast } from './utils/raycast.js';
import { BLOCK } from './world/blocks.js';
import { BlockInteraction } from './game/BlockInteraction.js';
import { Inventory } from './ui/Inventory.js';
import { InventoryState } from './ui/InventoryState.js';
import { Sky } from './world/Sky.js';
import { CommandInput } from './ui/CommandInput.js';
import { CommandHandler } from './game/CommandHandler.js';
import { updateParticles } from './utils/particles.js';
import { HUD } from './ui/HUD.js';
import { UIManager } from './ui/UIManager.js';
import { SaveManager } from './world/SaveManager.js';
import { PlayerBody } from './player/PlayerBody.js';
import { Multiplayer } from './lib/Multiplayer.js';
import { MobileControls } from './ui/MobileControls.js';

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.FogExp2(0x87CEEB, 0.006);

// --- Camera ---
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 800);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Join code helpers ---
// Code format: "WORLDID-SEED"  e.g. "ABC123-987654321"
function genWorldId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
function encodeJoinCode(worldId, seed) { return `${worldId}-${seed}`; }
function decodeJoinCode(code) {
  const parts = code.trim().toUpperCase().split('-');
  if (parts.length !== 2) return null;
  const seed = parseInt(parts[1], 10);
  if (!parts[0] || isNaN(seed)) return null;
  return { worldId: parts[0], seed };
}

// Legacy URL-based join (browser link sharing still works)
const _urlParams   = new URLSearchParams(location.search);
const _joinWorldId = _urlParams.get('world');
const _joinSeed    = _urlParams.get('seed') ? parseInt(_urlParams.get('seed'), 10) : null;

// --- Home screen elements ---
const homeScreen  = document.getElementById('home-screen');
const createModal = document.getElementById('create-world-modal');
const loadModal   = document.getElementById('load-world-modal');
const joinModal   = document.getElementById('join-world-modal');
const cwName      = document.getElementById('cw-name');
const cwSeed      = document.getElementById('cw-seed');
const btnNewWorld  = document.getElementById('btn-new-world');
const btnLoadWorld = document.getElementById('btn-load-world');
const btnJoinWorld = document.getElementById('btn-join-world');

// Disable buttons until auth is ready
btnNewWorld.disabled  = true;
btnLoadWorld.disabled = true;
btnJoinWorld.disabled = true;

SaveManager.init().then(() => {
  if (_joinWorldId && _joinSeed) {
    homeScreen.remove();
    startGame(null, _joinSeed, null, _joinWorldId);
  } else {
    btnNewWorld.disabled  = false;
    btnLoadWorld.disabled = false;
    btnJoinWorld.disabled = false;
  }
}).catch(err => {
  console.error('Auth failed:', err);
  btnNewWorld.disabled  = false;
  btnLoadWorld.disabled = false;
  btnJoinWorld.disabled = false;
});

// --- Home screen wiring ---
btnNewWorld.addEventListener('click', () => {
  createModal.classList.add('open');
  cwName.focus();
});

btnLoadWorld.addEventListener('click', () => openLoadModal());

btnJoinWorld.addEventListener('click', () => {
  joinModal.classList.add('open');
  document.getElementById('jw-code').value = '';
  document.getElementById('jw-error').textContent = '';
  document.getElementById('jw-code').focus();
});

document.getElementById('cw-back').addEventListener('click', () => {
  createModal.classList.remove('open');
});

// --- Join world modal wiring ---
function launchJoinGame() {
  const raw     = document.getElementById('jw-code').value;
  const parsed  = decodeJoinCode(raw);
  if (!parsed) {
    document.getElementById('jw-error').textContent = 'Invalid code. Format: XXXXXX-1234567890';
    return;
  }
  joinModal.classList.remove('open');
  homeScreen.remove();
  startGame(null, parsed.seed, null, parsed.worldId);
}
document.getElementById('jw-join').addEventListener('click', launchJoinGame);
document.getElementById('jw-back').addEventListener('click', () => joinModal.classList.remove('open'));
document.getElementById('jw-code').addEventListener('keydown', e => { if (e.key === 'Enter') launchJoinGame(); });

document.getElementById('cw-create').addEventListener('click', launchNewGame);
cwSeed.addEventListener('keydown', e => { if (e.key === 'Enter') launchNewGame(); });
cwName.addEventListener('keydown', e => { if (e.key === 'Enter') cwSeed.focus(); });

document.getElementById('lw-back').addEventListener('click', () => {
  loadModal.classList.remove('open');
});

// --- Helpers ---
function fmtBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

async function openLoadModal() {
  const container = document.getElementById('lw-list');
  container.innerHTML = '<p class="lw-empty">Loading…</p>';
  loadModal.classList.add('open');

  const list = await SaveManager.list();
  container.innerHTML = '';

  if (list.length === 0) {
    container.innerHTML = '<p class="lw-empty">No saved worlds yet.</p>';
  } else {
    for (const { name, lastPlayed } of list) {
      const row = document.createElement('div');
      row.className = 'lw-row';
      const date = new Date(lastPlayed).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const size = fmtBytes(await SaveManager.worldBytes(name));
      row.innerHTML = `
        <div class="lw-info">
          <span class="lw-name">${name}</span>
          <span class="lw-meta">Last played ${date} &nbsp;·&nbsp; ${size}</span>
        </div>
        <div class="lw-actions">
          <button class="lw-btn lw-play" data-name="${name}">Play</button>
          <button class="lw-btn lw-del" data-name="${name}">Delete</button>
        </div>`;
      container.appendChild(row);
    }
    container.querySelectorAll('.lw-play').forEach(btn => {
      btn.addEventListener('click', () => launchLoadGame(btn.dataset.name));
    });
    container.querySelectorAll('.lw-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm(`Delete "${btn.dataset.name}"? This cannot be undone.`)) {
          await SaveManager.delete(btn.dataset.name);
          openLoadModal();
        }
      });
    });
  }

  const { used, quota } = await SaveManager.storageInfo();
  const pct = Math.min(used / quota * 100, 100);
  document.getElementById('lw-storage-text').textContent = `${fmtBytes(used)} / ${fmtBytes(quota)}`;
  const fill = document.getElementById('lw-storage-fill');
  fill.style.width = `${pct}%`;
  fill.className = 'lw-storage-fill' + (pct >= 90 ? ' full' : pct >= 70 ? ' warn' : '');
}

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  return Math.abs(h) || 1;
}

function launchNewGame() {
  const name    = cwName.value.trim() || 'My World';
  const seedStr = cwSeed.value.trim();
  const seed    = seedStr ? hashSeed(seedStr) : Math.floor(Math.random() * 2_147_483_647) + 1;
  const worldId = genWorldId();
  history.replaceState(null, '', `?world=${worldId}&seed=${seed}`);
  createModal.classList.remove('open');
  homeScreen.remove();
  startGame(name, seed, null, worldId);
}

async function launchLoadGame(name) {
  const save = await SaveManager.load(name);
  if (!save) { alert('Failed to load world.'); return; }
  const worldId = genWorldId();
  history.replaceState(null, '', `?world=${worldId}&seed=${save.seed}`);
  loadModal.classList.remove('open');
  homeScreen.remove();
  startGame(name, save.seed, save, worldId);
}

// --- Game ---
function startGame(worldName, seed, saveData, worldId) {
  const world    = new World(scene, seed);
  const player   = new Player(camera, world);
  const controls = new Controls(renderer.domElement);
  const sky      = new Sky(scene);

  const inventoryState   = new InventoryState();
  const droppedItems     = [];
  const blockInteraction = new BlockInteraction({
    scene, world, player, controls, inventoryState,
    atlasCanvas: world.atlasCanvas, droppedItems,
  });

  const commandInput   = new CommandInput();
  const hud            = new HUD(inventoryState, world.atlasCanvas, player, sky.time);
  const commandHandler = new CommandHandler(sky, player, () => hud.refreshHearts());
  commandInput.onCommand = (raw) => commandHandler.handle(raw);

  const inventory = new Inventory(world.atlasCanvas, inventoryState);
  const uiManager = new UIManager({ renderer, controls, commandInput, inventory, player, hud, world });
  new MobileControls(controls, uiManager);

  // Show join code in pause screen so the host can share it
  const joinCodeEl = document.getElementById('pause-join-code');
  if (joinCodeEl) {
    const code = encodeJoinCode(worldId, seed);
    joinCodeEl.querySelector('.pause-join-code-value').textContent = code;
    joinCodeEl.querySelector('.pause-join-copy').onclick = () => {
      navigator.clipboard.writeText(code).then(() => {
        const btn = joinCodeEl.querySelector('.pause-join-copy');
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
      });
    };
  }

  world.update(0, 0);

  if (saveData) {
    world.loadSavedChunks(saveData.chunks);
    player.pos.set(saveData.player.pos.x, saveData.player.pos.y, saveData.player.pos.z);
    player.health    = saveData.player.health;
    player.creative  = saveData.player.creative;
    player.flying    = saveData.player.flying;
    controls.yaw     = saveData.player.yaw   ?? 0;
    controls.pitch   = saveData.player.pitch ?? 0;
    sky.time         = saveData.time;
  } else {
    const spawnPt = world.findLandSpawn(0, 0);
    player.pos.set(spawnPt.x, spawnPt.y, spawnPt.z);
  }

  async function doSave() {
    if (!worldName) return;
    player.yaw   = controls.yaw;
    player.pitch = controls.pitch;
    await SaveManager.save(worldName, seed, world, player, sky);
  }

  function handleUnload() {
    multiplayer.leave();
    doSave();
  }

  window.addEventListener('beforeunload', handleUnload);
  uiManager.onQuit = async () => {
    multiplayer.leave();
    window.removeEventListener('beforeunload', handleUnload);
    await doSave();
  };

  const AUTOSAVE_INTERVAL = 30;
  let autosaveTimer = 0;

  const damageFlash  = document.getElementById('damage-flash');
  const waterOverlay = document.getElementById('water-overlay');
  let lastHealth     = player.health;
  let _wasUnderwater = false;

  const playerBody = new PlayerBody(scene);

  const multiplayer = new Multiplayer(scene, worldId, crypto.randomUUID());
  multiplayer.join(() => ({
    pos: { x: player.pos.x, y: player.pos.y, z: player.pos.z },
    yaw: controls.yaw,
    vel: { x: player.vel.x, y: player.vel.y, z: player.vel.z },
  }));

  const dir = new THREE.Vector3();
  let lastTime = performance.now();
  let elapsed  = 0;

  function loop() {
    requestAnimationFrame(loop);

    const now = performance.now();
    const dt  = Math.min((now - lastTime) / 1000, 0.1);
    lastTime  = now;
    elapsed  += dt;
    grassUniforms.time.value = elapsed;

    autosaveTimer += dt;
    if (autosaveTimer >= AUTOSAVE_INTERVAL) {
      doSave();
      autosaveTimer = 0;
    }

    sky.update(dt, camera, world.material, world.waterMaterial);
    multiplayer.update(dt, sky.ambient);
    updateParticles(dt);

    if (!uiManager.inventoryOpen) {
      player.update(dt, controls);
      playerBody.update(player.pos, controls.yaw, controls.perspective, dt, player.vel, sky.ambient);
      world.update(player.pos.x, player.pos.z, dt);

      for (let i = droppedItems.length - 1; i >= 0; i--) {
        const collected = droppedItems[i].update(dt, world.getBlock.bind(world), camera.position);
        if (collected) {
          const id = droppedItems[i].blockId;
          droppedItems[i].remove();
          droppedItems.splice(i, 1);
          inventoryState.addItem(id, 1);
        }
      }

      camera.getWorldDirection(dir);
      const hit = raycast(world.getBlock.bind(world), camera.position, dir);
      blockInteraction.update(dt, hit, hud.selectedSlot);

      if (player.health !== lastHealth) {
        hud.refreshHearts();
        if (player.health < lastHealth) {
          damageFlash.classList.add('active');
          setTimeout(() => damageFlash.classList.remove('active'), 200);
        }
        if (player.health <= 0) {
          player.health = player.maxHealth;
          player.vel.set(0, 0, 0);
          const sp = world.findLandSpawn(0, 0);
          player.pos.set(sp.x, sp.y, sp.z);
          player._fallMaxY = null;
          hud.refreshHearts();
        }
        lastHealth = player.health;
      }
    }

    camera.getWorldDirection(dir);

    const eyeBlock = world.getBlock(
      Math.floor(camera.position.x),
      Math.floor(camera.position.y),
      Math.floor(camera.position.z),
    );
    const underwater = eyeBlock === BLOCK.WATER || eyeBlock === BLOCK.WATER_FLOWING;
    if (underwater !== _wasUnderwater) {
      _wasUnderwater = underwater;
      waterOverlay.classList.toggle('active', underwater);
    }
    if (underwater) {
      scene.fog.color.setRGB(0.05, 0.19, 0.51);
      scene.fog.density = 0.09;
    }

    hud.update(dt, player, sky, controls, world, dir);
    renderer.render(scene, camera);
  }

  loop();
  if (!controls.mobile) {
    renderer.domElement.requestPointerLock().catch(() => {
      document.addEventListener('click', () => renderer.domElement.requestPointerLock(), { once: true });
    });
  }
}
