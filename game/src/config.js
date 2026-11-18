// config.js — shared constants for Solmar Bay: Streets of the Sun.
// World size, view size, tuning numbers and the district table live here so
// every other module reads the same numbers.

export const WORLD_W = 5200;
export const WORLD_H = 3800;
export const VIEW_W = 1280;
export const VIEW_H = 720;

export const PLAYER_RADIUS = 13;
export const PLAYER_WALK_SPEED = 118;
export const PLAYER_RUN_SPEED = 196;
export const PLAYER_MAX_HP = 100;

export const WANTED_DECAY_SECONDS = 26;   // quiet time before a star fades
export const BUST_FINE_RATE = 0.12;       // share of cash lost when busted
export const SAFEHOUSE_NAME = 'Casa Solmar';
export const POLICE_STATION = { x: 2565, y: 420 };

export const SAVE_KEY = 'solmar-bay-save-v2';

// The seven districts: name, bounds, ground tint and building palette.
// Palettes are warm and sun-bleached; downtown glass is the cool exception.
export const DISTRICTS = [
  { id: 'lomas',   name: 'Las Lomas',    x: 0,    y: 0,    w: 1700, h: 1760, ground: '#cfe0b4',
    walls: ['#f2e3c2', '#eecfa5', '#f6ead2', '#e8d3ae', '#f0dcbb'] },
  { id: 'centro',  name: 'Centro Dorado', x: 1700, y: 0,   w: 1700, h: 1760, ground: '#d9d2c2',
    walls: ['#b9cdd6', '#a8c3d4', '#c7d6cf', '#9fb8c9', '#d3cfc0', '#8fa9bd'] },
  { id: 'mercado', name: 'Mercado Viejo', x: 3400, y: 0,   w: 1800, h: 1760, ground: '#e6cf9f',
    walls: ['#e8a56b', '#df8f52', '#f0b878', '#d97e4a', '#eab086', '#cf7440'] },
  { id: 'puerto',  name: 'Puerto Alba',   x: 0,    y: 1760, w: 1700, h: 1540, ground: '#c9c2ae',
    walls: ['#b0a58e', '#9d927c', '#bfb49c', '#8f8672', '#a89d85'] },
  { id: 'marina',  name: 'Marina Azul',   x: 1700, y: 1760, w: 1700, h: 1540, ground: '#cfe3d2',
    walls: ['#f4ecd8', '#e9f0e4', '#f8f2e2', '#dcead9', '#f2e8ce'] },
  { id: 'norte',   name: 'Barrio Norte',  x: 3400, y: 1760, w: 1800, h: 1540, ground: '#d3c8b4',
    walls: ['#c4b299', '#b3a184', '#cfbda0', '#a08e70', '#bcae94'] },
  { id: 'playa',   name: 'Playa Serena',  x: 0,    y: 3300, w: 5200, h: 500,  ground: '#f0dcae',
    walls: ['#f7efdb', '#f2e6c8'] },
];

export const SEA_Y = 3560;          // water starts here, along the south edge
export const SAND_Y = 3300;         // sand starts here
export const PROMENADE_Y = 3330;    // palm walk between road and sand

export const CLOCK_START_MIN = 10 * 60 + 20;  // 10:20 in the morning
export const CLOCK_RATE = 0.55;               // game minutes per real second

export const KEYBINDS_TEXT = [
  'WASD / Arrows — walk & drive',
  'Shift — run · Space — handbrake',
  'E — enter / exit car · F — also enter',
  'Mouse — aim · Click — fire',
  'Q or 1 / 2 — switch weapon',
  'J — missions board · P / Esc — pause · M — mute',
];
