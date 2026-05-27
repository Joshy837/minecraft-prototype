import { TILE } from '../utils/textureAtlas.js';

export const BLOCK = {
  AIR:        0,
  GRASS:      1,
  DIRT:       2,
  STONE:      3,
  LOG:        4,
  SAND:       5,
  GRAVEL:     6,
  SNOW:       7,
  LEAVES:     8,
  WATER:      9,
  PATH:       10,
  // 16 Minecraft-style colored blocks
  WHITE:      11,
  ORANGE:     12,
  MAGENTA:    13,
  LIGHT_BLUE: 14,
  YELLOW:     15,
  LIME:       16,
  PINK:       17,
  GRAY:       18,
  LIGHT_GRAY: 19,
  CYAN:       20,
  PURPLE:     21,
  BLUE:       22,
  BROWN:      23,
  GREEN:      24,
  RED:        25,
  BLACK:      26,
  COBBLESTONE:27,
  // Doors: 4 facing directions × closed/open = 8 IDs
  DOOR_CLOSED:   28,
  DOOR_OPEN:     29,
  DOOR_CLOSED_X: 30,
  DOOR_OPEN_X:   31,
  DOOR_CLOSED_N: 32,
  DOOR_OPEN_N:   33,
  DOOR_CLOSED_W: 34,
  DOOR_OPEN_W:   35,
  WATER_FLOWING:  36,
  TALL_GRASS:     37,
  BIRCH_LOG:      38,
  SPRUCE_LOG:     39,
  BIRCH_LEAVES:   40,
  SPRUCE_LEAVES:  41,
  BUCKET:         42,
  WATER_BUCKET:   43,
  COAL_ORE:       44,
  IRON_ORE:       45,
  GOLD_ORE:       46,
  LAPIS_ORE:      47,
  REDSTONE_ORE:   48,
  DIAMOND_ORE:    49,
  GLASS:          50,
  GLASS_PANE:     51,
};

const _COLOR_NAMES = ['White','Orange','Magenta','Light Blue','Yellow','Lime','Pink','Gray','Light Gray','Cyan','Purple','Blue','Brown','Green','Red','Black'];
const _COLOR_HEX   = [0xE5E5E5,0xD87F33,0xB24CD8,0x6699D8,0xE5E533,0x7FCC19,0xF27FA5,0x4C4C4C,0x999999,0x4C7F99,0x7F3FB2,0x334CB2,0x664C33,0x667F33,0x993333,0x191919];
const _COLOR_TILES = [TILE.WHITE,TILE.ORANGE,TILE.MAGENTA,TILE.LIGHT_BLUE,TILE.YELLOW,TILE.LIME,TILE.PINK,TILE.GRAY,TILE.LIGHT_GRAY,TILE.CYAN,TILE.PURPLE,TILE.BLUE,TILE.BROWN,TILE.GREEN,TILE.RED,TILE.BLACK];

export const BLOCK_DEF = {
  [BLOCK.GRASS]:      { name: 'Grass',       color: 0x5DA831, top: TILE.GRASS_TOP,   side: TILE.GRASS_SIDE, bottom: TILE.DIRT,        hardness: 0.9,  drop: BLOCK.GRASS      },
  [BLOCK.DIRT]:       { name: 'Dirt',        color: 0x8B6914, top: TILE.DIRT,        side: TILE.DIRT,       bottom: TILE.DIRT,        hardness: 0.75, drop: BLOCK.DIRT       },
  [BLOCK.STONE]:      { name: 'Stone',       color: 0x888888, top: TILE.STONE,       side: TILE.STONE,      bottom: TILE.STONE,       hardness: 3.0,  drop: BLOCK.COBBLESTONE},
  [BLOCK.LOG]:        { name: 'Log',         color: 0x8D6E3C, top: TILE.LOG_TOP,     side: TILE.LOG_SIDE,   bottom: TILE.LOG_TOP,     hardness: 1.5,  drop: BLOCK.LOG        },
  [BLOCK.SAND]:       { name: 'Sand',        color: 0xDDD08C, top: TILE.SAND,        side: TILE.SAND,       bottom: TILE.SAND,        hardness: 0.75, drop: BLOCK.SAND       },
  [BLOCK.GRAVEL]:     { name: 'Gravel',      color: 0x9E9E9E, top: TILE.GRAVEL,      side: TILE.GRAVEL,     bottom: TILE.GRAVEL,      hardness: 0.9,  drop: BLOCK.GRAVEL     },
  [BLOCK.SNOW]:       { name: 'Snow',        color: 0xEEEEFF, top: TILE.SNOW_TOP,    side: TILE.SNOW_SIDE,  bottom: TILE.DIRT,        hardness: 0.2,  drop: BLOCK.SNOW       },
  [BLOCK.LEAVES]:     { name: 'Leaves',      color: 0x3A7D2C, top: TILE.LEAVES,      side: TILE.LEAVES,     bottom: TILE.LEAVES,      hardness: 0.3,  drop: 0                },
  [BLOCK.WATER]:      { name: 'Water',       color: 0x2255CC, top: TILE.WATER,       side: TILE.WATER,      bottom: TILE.WATER,       hardness: Infinity, drop: 0, passable: true },
  [BLOCK.PATH]:       { name: 'Path',        color: 0xB8966F, top: TILE.PATH,        side: TILE.PATH,       bottom: TILE.PATH,        hardness: 0.9,  drop: BLOCK.DIRT       },
  [BLOCK.COBBLESTONE]:{ name: 'Cobblestone', color: 0x888888, top: TILE.COBBLESTONE, side: TILE.COBBLESTONE,bottom: TILE.COBBLESTONE, hardness: 3.5,  drop: BLOCK.COBBLESTONE},
  [BLOCK.DOOR_CLOSED]:  { name: 'Door',        color: 0x8D6E3C, top: TILE.DOOR, side: TILE.DOOR, bottom: TILE.DOOR, hardness: 1.5, drop: BLOCK.DOOR_CLOSED,  isDoor: true },
  [BLOCK.DOOR_OPEN]:    { name: 'Door (Open)', color: 0x8D6E3C, top: TILE.DOOR, side: TILE.DOOR, bottom: TILE.DOOR, hardness: 1.5, drop: 0,                  isDoor: true },
  [BLOCK.DOOR_CLOSED_X]:{ name: 'Door',        color: 0x8D6E3C, top: TILE.DOOR, side: TILE.DOOR, bottom: TILE.DOOR, hardness: 1.5, drop: BLOCK.DOOR_CLOSED,  isDoor: true },
  [BLOCK.DOOR_OPEN_X]:  { name: 'Door (Open)', color: 0x8D6E3C, top: TILE.DOOR, side: TILE.DOOR, bottom: TILE.DOOR, hardness: 1.5, drop: 0,                  isDoor: true },
  [BLOCK.DOOR_CLOSED_N]:{ name: 'Door',        color: 0x8D6E3C, top: TILE.DOOR, side: TILE.DOOR, bottom: TILE.DOOR, hardness: 1.5, drop: BLOCK.DOOR_CLOSED,  isDoor: true },
  [BLOCK.DOOR_OPEN_N]:  { name: 'Door (Open)', color: 0x8D6E3C, top: TILE.DOOR, side: TILE.DOOR, bottom: TILE.DOOR, hardness: 1.5, drop: 0,                  isDoor: true },
  [BLOCK.DOOR_CLOSED_W]:{ name: 'Door',        color: 0x8D6E3C, top: TILE.DOOR, side: TILE.DOOR, bottom: TILE.DOOR, hardness: 1.5, drop: BLOCK.DOOR_CLOSED,  isDoor: true },
  [BLOCK.DOOR_OPEN_W]:  { name: 'Door (Open)', color: 0x8D6E3C, top: TILE.DOOR, side: TILE.DOOR, bottom: TILE.DOOR, hardness: 1.5, drop: 0,                  isDoor: true },
  [BLOCK.WATER_FLOWING]:{ name: 'Water',         color: 0x2255CC, top: TILE.WATER,          side: TILE.WATER,           bottom: TILE.WATER,          hardness: Infinity, drop: 0, passable: true },
  [BLOCK.TALL_GRASS]:   { name: 'Tall Grass',    color: 0x5DA831, top: TILE.TALL_GRASS,     side: TILE.TALL_GRASS,      bottom: TILE.TALL_GRASS,     hardness: 0,        drop: 0,       isItem: true },
  [BLOCK.BIRCH_LOG]:    { name: 'Birch Log',     color: 0xD8D0B8, top: TILE.BIRCH_LOG_TOP,  side: TILE.BIRCH_LOG_SIDE,  bottom: TILE.BIRCH_LOG_TOP,  hardness: 1.5,      drop: BLOCK.BIRCH_LOG  },
  [BLOCK.SPRUCE_LOG]:   { name: 'Spruce Log',    color: 0x5A3C18, top: TILE.SPRUCE_LOG_TOP, side: TILE.SPRUCE_LOG_SIDE, bottom: TILE.SPRUCE_LOG_TOP, hardness: 1.5,      drop: BLOCK.SPRUCE_LOG },
  [BLOCK.BIRCH_LEAVES]: { name: 'Birch Leaves',  color: 0x6AAD28, top: TILE.BIRCH_LEAVES,   side: TILE.BIRCH_LEAVES,    bottom: TILE.BIRCH_LEAVES,   hardness: 0.3,      drop: 0                },
  [BLOCK.SPRUCE_LEAVES]:{ name: 'Spruce Leaves', color: 0x2A5428, top: TILE.SPRUCE_LEAVES,  side: TILE.SPRUCE_LEAVES,   bottom: TILE.SPRUCE_LEAVES,  hardness: 0.3,      drop: 0                },
  [BLOCK.BUCKET]:       { name: 'Bucket',        color: 0xAAAAAA, top: TILE.BUCKET,          side: TILE.BUCKET,          bottom: TILE.BUCKET,         hardness: Infinity, drop: 0, isItem: true },
  [BLOCK.WATER_BUCKET]: { name: 'Water Bucket',  color: 0x2255CC, top: TILE.WATER_BUCKET,    side: TILE.WATER_BUCKET,    bottom: TILE.WATER_BUCKET,   hardness: Infinity, drop: 0, isItem: true },
  [BLOCK.COAL_ORE]:     { name: 'Coal Ore',      color: 0x303030, top: TILE.COAL_ORE,        side: TILE.COAL_ORE,        bottom: TILE.COAL_ORE,       hardness: 3.0, drop: BLOCK.COAL_ORE    },
  [BLOCK.IRON_ORE]:     { name: 'Iron Ore',      color: 0xC09060, top: TILE.IRON_ORE,        side: TILE.IRON_ORE,        bottom: TILE.IRON_ORE,       hardness: 3.5, drop: BLOCK.IRON_ORE    },
  [BLOCK.GOLD_ORE]:     { name: 'Gold Ore',      color: 0xFFCC00, top: TILE.GOLD_ORE,        side: TILE.GOLD_ORE,        bottom: TILE.GOLD_ORE,       hardness: 4.5, drop: BLOCK.GOLD_ORE    },
  [BLOCK.LAPIS_ORE]:    { name: 'Lapis Ore',     color: 0x1244CC, top: TILE.LAPIS_ORE,       side: TILE.LAPIS_ORE,       bottom: TILE.LAPIS_ORE,      hardness: 3.5, drop: BLOCK.LAPIS_ORE   },
  [BLOCK.REDSTONE_ORE]: { name: 'Redstone Ore',  color: 0xFF5500, top: TILE.REDSTONE_ORE,    side: TILE.REDSTONE_ORE,    bottom: TILE.REDSTONE_ORE,   hardness: 4.5, drop: BLOCK.REDSTONE_ORE },
  [BLOCK.DIAMOND_ORE]:  { name: 'Diamond Ore',   color: 0x24E0DC, top: TILE.DIAMOND_ORE,     side: TILE.DIAMOND_ORE,     bottom: TILE.DIAMOND_ORE,    hardness: 5.0, drop: BLOCK.DIAMOND_ORE  },
  [BLOCK.GLASS]:        { name: 'Glass',         color: 0xC8E8F0, top: TILE.GLASS,           side: TILE.GLASS,           bottom: TILE.GLASS,          hardness: 0.3, drop: 0                },
  [BLOCK.GLASS_PANE]:   { name: 'Glass Pane',   color: 0xC8E8F0, top: TILE.GLASS,           side: TILE.GLASS,           bottom: TILE.GLASS,          hardness: 0.3, drop: 0, icon2D: true },
  ...Object.fromEntries(_COLOR_NAMES.map((name, i) => [
    11 + i,
    { name, color: _COLOR_HEX[i], top: _COLOR_TILES[i], side: _COLOR_TILES[i], bottom: _COLOR_TILES[i], hardness: 1.2, drop: 11 + i },
  ])),
};

export const HOTBAR = [
  BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.LOG, BLOCK.SAND,
  BLOCK.COBBLESTONE, BLOCK.RED, BLOCK.DOOR_CLOSED,
];

export function isPaneConnector(id) {
  if (id === BLOCK.GLASS_PANE) return true;
  const def = BLOCK_DEF[id];
  if (!def || def.passable || def.isItem) return false;
  if (id === BLOCK.GLASS || def.isDoor) return false;
  return true;
}

export function isDoor(id) {
  return !!(BLOCK_DEF[id]?.isDoor);
}

export function doorToggle(id) {
  return id % 2 === 0 ? id + 1 : id - 1;
}
