# minecraft-prototype

Minecraft-like voxel game. Vanilla JS + Three.js + Vite. No TypeScript, no framework.

## Run
```
npm run dev    # Vite dev server
npm run build  # production build
```

## Source layout (`src/`)
| File | Responsibility |
|------|----------------|
| `main.js` | Entry: renderer, scene, game loop, input dispatch, HUD |
| `world/World.js` | Chunk lifecycle, `getBlock`/`setBlock`, mesh updates |
| `world/Chunk.js` | Greedy-mesh geometry builder for one 16³ chunk |
| `world/blocks.js` | `BLOCK_DEF` map, `BLOCK` enum, `HOTBAR` default |
| `world/Village.js` | Procedural village placement |
| `world/Sky.js` | Day/night cycle, sky color, fog, time string |
| `world/DroppedItem.js` | Physics + bobbing mesh for a block dropped in the world; auto-collected on proximity |
| `player/Player.js` | AABB physics, gravity, fall damage, health, regen |
| `player/Controls.js` | Pointer-lock mouse/keyboard input, yaw/pitch |
| `utils/textureAtlas.js` | Canvas-based texture atlas, `getTileRect` |
| `utils/raycast.js` | DDA block raycast, returns `{pos, placePos}` |
| `utils/noise.js` | Simplex noise for terrain generation |
| `utils/crackTexture.js` | Generates 10-stage crack overlay `CanvasTexture` array for block-break animation |
| `utils/particles.js` | Module-level particle pool; `spawnBlockBreak` / `updateParticles` |
| `ui/Inventory.js` | Inventory overlay UI rendering |
| `ui/InventoryState.js` | 36-slot inventory data model (hotbar 0–8, main 9–35); cursor, stacking, shift-click |
| `ui/CommandInput.js` | `/`-triggered chat/command bar with 5-line scrollback log |

## Key conventions
- Block IDs: `0` = air. Doors use even=closed / odd=open, IDs 28–35 (4 orientations × 2 states). `WATER` (9) = source block; `WATER_FLOWING` (36) = BFS-spread variant. `TALL_GRASS` (37), `BUCKET` (42), `WATER_BUCKET` (43) are also defined.
- `BLOCK_DEF[id]` fields: `hardness` (break time in seconds), `drop` (block ID spawned as dropped item; 0 = nothing), `passable: true` (water), `isItem: true` (non-placeable items like tall grass, bucket).
- Chunks are 16×16×256. `World` keeps a render-distance ring (radius 8) of loaded chunks. `SEA_LEVEL = 14`.
- Texture atlas is a runtime-generated canvas; tile coords come from `getTileRect(tileIndex)`.
- `controls.yaw` is the canonical camera yaw (used for door placement direction).
- Health: `player.damage(n)` applies damage and starts a 5 s regen cooldown. Passive regen ticks +1 HP every 4 s when below max.
- Creative mode: `player.creative` disables fall damage. Double-tap Space toggles `player.flying`.
- Water physics: BFS simulation ticks every 0.25 s. Placing a source block calls `world.addWaterSource(x,y,z)`. Breaking one triggers a full re-simulation drain+refill cycle.
- Biomes (driven by `biomeNoise`): low = oak forest, mid = birch forest, high+elevation = spruce/taiga. Trees at h > SEA_LEVEL+1 and h < 44.
- Commands (`/` key opens `CommandInput`): `/time set|query`, `/gamemode` (`/gm`), `/tp`.
