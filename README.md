# minecraft-prototype

A Minecraft-like voxel game built with vanilla JavaScript, Three.js, and Vite.

## Features

- Procedurally generated terrain with biomes (oak forest, birch forest, spruce/taiga)
- Day/night cycle with dynamic sky color and fog
- Block placement and breaking with crack animations and particle effects
- Greedy-mesh chunk rendering (16×16×256 chunks)
- AABB physics with gravity, fall damage, health, and passive regen
- Water physics with BFS spread simulation
- Inventory system with hotbar, stacking, and shift-click
- Dropped item pickups with bobbing physics
- Procedural village generation
- Third-person camera with Steve-skin player model
- World save/load via Supabase
- Creative mode with flying (`double-tap Space`)
- Chat/command bar (`/` key): `/time`, `/gamemode` (`/gm`), `/tp`
- **Multiplayer** via Supabase Realtime — join with a `WORLDID-SEED` join code, see other players rendered with animated Steve bodies
- **Mobile controls** — virtual joystick (move), look/tap zone (look), break/jump/sneak/inventory buttons, auto-sprint
- **PWA** — installable, offline-capable via Workbox precaching, fullscreen landscape manifest

## Getting started

```bash
npm install
npm run dev      # Vite dev server at http://localhost:5173
npm run build    # Production build
npm run preview  # Preview production build
```

## Controls

### Desktop

| Key | Action |
|-----|--------|
| WASD | Move |
| Space | Jump / fly up (creative) |
| Shift | Sneak / fly down (creative) |
| Left click | Break block |
| Right click | Place block |
| 1–9 | Hotbar slot |
| Scroll | Cycle hotbar |
| E | Open inventory |
| F5 | Toggle third-person camera |
| `/` | Open command input |
| Escape | Release pointer lock |

### Mobile

| Control | Action |
|---------|--------|
| Left joystick | Move |
| Right zone drag | Look |
| Right zone tap | Place block |
| Break button | Break block |
| Jump / Sneak buttons | Jump / sneak |
| Inventory button | Open inventory |

## Stack

- [Three.js](https://threejs.org/) — 3D rendering
- [Vite](https://vitejs.dev/) — dev server and bundler
- [Supabase](https://supabase.com/) — world persistence and multiplayer (Realtime presence)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) — PWA / offline support

## Source layout

| File | Responsibility |
|------|----------------|
| `src/main.js` | Entry: renderer, scene, game loop, input dispatch, HUD |
| `src/config.js` | Shared constants (render distance, etc.) |
| `src/world/World.js` | Chunk lifecycle, `getBlock`/`setBlock`, mesh updates |
| `src/world/Chunk.js` | Greedy-mesh geometry builder for one 16³ chunk |
| `src/world/blocks.js` | `BLOCK_DEF` map, `BLOCK` enum, `HOTBAR` default |
| `src/world/Village.js` | Procedural village placement |
| `src/world/Sky.js` | Day/night cycle, sky color, fog, time string |
| `src/world/DroppedItem.js` | Physics + bobbing mesh for dropped blocks |
| `src/world/WaterSimulator.js` | BFS water spread/drain simulation |
| `src/world/SaveManager.js` | Supabase world save/load |
| `src/player/Player.js` | AABB physics, gravity, fall damage, health, regen |
| `src/player/Controls.js` | Pointer-lock mouse/keyboard + mobile input, yaw/pitch |
| `src/player/PlayerBody.js` | Animated Steve-skin player body mesh |
| `src/player/steveSkin.js` | Steve skin texture data |
| `src/game/BlockInteraction.js` | Block break/place logic |
| `src/game/CommandHandler.js` | `/time`, `/gamemode`, `/tp` command parsing |
| `src/lib/Multiplayer.js` | Supabase Realtime presence, remote player sync |
| `src/lib/supabase.js` | Supabase client initialisation |
| `src/utils/textureAtlas.js` | Canvas-based texture atlas |
| `src/utils/raycast.js` | DDA block raycast |
| `src/utils/noise.js` | Simplex noise for terrain generation |
| `src/utils/crackTexture.js` | 10-stage crack overlay textures |
| `src/utils/particles.js` | Block-break particle pool |
| `src/utils/glassPaneGeom.js` | Thin-pane geometry for glass blocks |
| `src/ui/HUD.js` | HUD rendering (health, hotbar, crosshair) |
| `src/ui/UIManager.js` | Pause/inventory visibility, pointer-lock management |
| `src/ui/MobileControls.js` | Virtual joystick and touch buttons for mobile |
| `src/ui/Inventory.js` | Inventory overlay UI |
| `src/ui/InventoryState.js` | 36-slot inventory data model |
| `src/ui/CommandInput.js` | `/`-triggered command bar with scrollback |
