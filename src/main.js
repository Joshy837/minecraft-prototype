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

// --- Core systems ---
const world    = new World(scene);
const player   = new Player(camera, world);
const controls = new Controls(renderer.domElement);
const sky      = new Sky(scene);

const inventoryState   = new InventoryState();
const droppedItems     = [];
const blockInteraction = new BlockInteraction({
  scene, world, player, controls, inventoryState,
  atlasCanvas: world.atlasCanvas, droppedItems,
});

// --- UI ---
const commandInput = new CommandInput();
const hud          = new HUD(inventoryState, world.atlasCanvas, player, sky.time);
const commandHandler = new CommandHandler(sky, player, () => hud.refreshHearts());
commandInput.onCommand = (raw) => commandHandler.handle(raw);

const inventory = new Inventory(world.atlasCanvas, inventoryState);
const uiManager = new UIManager({ renderer, controls, commandInput, inventory, player, hud, world });

// --- Spawn ---
const spawnPt = world.findLandSpawn(0, 0);
player.pos.set(spawnPt.x, spawnPt.y, spawnPt.z);

// --- Overlay elements ---
const damageFlash  = document.getElementById('damage-flash');
const waterOverlay = document.getElementById('water-overlay');
let lastHealth     = player.health;
let _wasUnderwater = false;

// --- Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Game loop ---
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

  sky.update(dt, camera, world.material, world.waterMaterial);
  updateParticles(dt);

  if (!uiManager.inventoryOpen) {
    player.update(dt, controls);
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

world.update(0, 0);
loop();
