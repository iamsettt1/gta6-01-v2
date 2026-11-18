// city.js — builds Solmar Bay itself: the road grid and diagonal boulevard,
// seven districts of buildings, market stalls, harbour containers, street
// props, the beach and the sea. One fixed seed, so the city never changes.
// Also owns the geometry questions other modules ask: what district is this,
// is this point on a road, and how does a circle slide out of the buildings.

import { DISTRICTS, WORLD_W, WORLD_H, SAND_Y, SEA_Y } from './config.js';
import { randRange, randInt, pickFrom, chance } from './random.js';

export const ROAD_W = 132;
export const ROAD_XS = [420, 1120, 1820, 2520, 3220, 3920, 4620];
export const ROAD_YS = [380, 1030, 1680, 2330, 2980];
// The Avenida del Faro: a diagonal boulevard from the harbour to the market.
export const BOULEVARD = { x1: 150, y1: 3060, x2: 5050, y2: 430, w: 118 };

const SPECIAL_BUILDINGS = [
  { name: 'Estación Solmar', x: 2620, y: 462, w: 210, h: 128, color: '#dfe7ea', kind: 'station' },
  { name: 'Casa Solmar', x: 1906, y: 2452, w: 138, h: 104, color: '#f6e7c8', kind: 'safehouse' },
  { name: 'Café Brisa', x: 520, y: 2450, w: 158, h: 112, color: '#f0c98f', kind: 'cafe' },
  { name: 'Marina Cash Office', x: 2980, y: 2760, w: 148, h: 104, color: '#e8e2d2', kind: 'office' },
  { name: 'Taller El Faro', x: 4010, y: 1840, w: 178, h: 122, color: '#cbb894', kind: 'garage' },
];

function blockSpans(centers, limit) {
  const spans = [];
  let start = 0;
  for (const c of centers) {
    spans.push([start, c - ROAD_W / 2]);
    start = c + ROAD_W / 2;
  }
  spans.push([start, limit]);
  return spans;
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[DISTRICTS.length - 1];
}

function rectsOverlap(a, b, pad) {
  return a.x - pad < b.x + b.w && a.x + a.w + pad > b.x &&
         a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
}

export function buildCity(rng) {
  const buildings = [];
  const props = [];
  const stalls = [];

  for (const s of SPECIAL_BUILDINGS) {
    buildings.push({ ...s, floors: 2, roof: '#8d99a0' });
  }

  const colSpans = blockSpans(ROAD_XS, WORLD_W);
  const rowSpans = blockSpans(ROAD_YS, SAND_Y);

  for (const [bx0, bx1] of colSpans) {
    for (const [by0, by1] of rowSpans) {
      const bw = bx1 - bx0;
      const bh = by1 - by0;
      if (bw < 150 || bh < 130) continue;
      const district = districtAt((bx0 + bx1) / 2, (by0 + by1) / 2);
      fillBlock(rng, district, bx0 + 24, by0 + 24, bw - 48, bh - 48, buildings, props);
    }
  }

  placeStreetProps(rng, props);
  placeBeachProps(rng, props);
  placeHarbourProps(rng, props);
  placeMarketStalls(rng, stalls, buildings);

  return {
    buildings, props, stalls,
    roadXs: ROAD_XS, roadYs: ROAD_YS, boulevard: BOULEVARD,
    safehouse: { x: 1975, y: 2504 },
    station: { x: 2565, y: 640 },
  };
}

function fillContainerYard(rng, x, y, w, h, buildings, props) {
  // The Puerto Alba container yard: stacks around the edges, open ground in
  // the middle where deals — and shootouts — happen.
  const stack = (sx, sy, sw, sh) => buildings.push({
    x: sx, y: sy, w: sw, h: sh, floors: 1, roof: '#6d6d6d', kind: 'container',
    color: pickFrom(rng, ['#c65b3f', '#3f7ea6', '#4d9e6b', '#c9a13b', '#7a6fc0']),
  });
  stack(x, y, 150, 62);
  stack(x + 170, y, 150, 62);
  stack(x + 340, y, 140, 62);
  stack(x, y + h - 62, 170, 62);
  stack(x + 330, y + h - 62, 150, 62);
  stack(x + w - 70, y + 90, 70, 130);
  stack(x + w - 70, y + 250, 70, 120);
  props.push({ kind: 'crane', x: x + w - 130, y: y + 60, r: 30 });
  props.push({ kind: 'barrel', x: x + 120, y: y + 150, r: 8 });
  props.push({ kind: 'barrel', x: x + 136, y: y + 158, r: 8 });
}

function fillBlock(rng, district, x, y, w, h, buildings, props) {
  if (district.id === 'puerto' && x < 820 && x + w > 820 && y < 2660 && y + h > 2660) {
    fillContainerYard(rng, x, y, w, h, buildings, props);
    return;
  }
  const isHarbour = district.id === 'puerto';
  const isDowntown = district.id === 'centro';
  const isHouses = district.id === 'lomas';
  const lotW = isDowntown ? randRange(rng, 128, 172) : randRange(rng, 112, 152);
  const lotH = isDowntown ? randRange(rng, 118, 160) : randRange(rng, 104, 142);
  const cols = Math.max(1, Math.floor(w / lotW));
  const rows = Math.max(1, Math.floor(h / lotH));
  const cellW = w / cols;
  const cellH = h / rows;

  for (let cx = 0; cx < cols; cx++) {
    for (let cy = 0; cy < rows; cy++) {
      const lx = x + cx * cellW;
      const ly = y + cy * cellH;
      const roll = rng();
      if (roll < 0.10) {
        // An open lot: parking, a garden or a dusty yard, with a prop or two.
        if (chance(rng, 0.7)) {
          props.push({ kind: chance(rng, 0.5) ? 'tree' : 'bench',
            x: lx + cellW / 2, y: ly + cellH / 2, r: 12 });
        }
        continue;
      }
      if (isHarbour && roll < 0.42) {
        // Container stacks read as low, bright, corrugated buildings.
        const stack = {
          x: lx + 8, y: ly + 10, w: cellW - 16, h: cellH - 20,
          color: pickFrom(rng, ['#c65b3f', '#3f7ea6', '#4d9e6b', '#c9a13b', '#7a6fc0']),
          floors: 1, roof: '#6d6d6d', kind: 'container',
        };
        if (!buildings.some((b) => rectsOverlap(stack, b, 4))) buildings.push(stack);
        continue;
      }
      const inset = isHouses ? 16 : 9;
      const b = {
        x: lx + inset, y: ly + inset,
        w: cellW - inset * 2, h: cellH - inset * 2,
        color: pickFrom(rng, district.walls),
        floors: isDowntown ? randInt(rng, 4, 9) : isHouses ? 1 : randInt(rng, 1, 4),
        roof: pickFrom(rng, ['#a89a83', '#97897a', '#b5a78f', '#8d8272']),
        kind: isHouses ? 'house' : isDowntown ? 'tower' : 'block',
        garden: isHouses,
      };
      // The market stall bands along the Mercado road stay clear of
      // buildings, so the stalls have somewhere to stand.
      if (district.id === 'mercado' && b.x < 5070 && b.x + b.w > 3540 &&
          ((b.y < 945 && b.y + b.h > 880) || (b.y < 1180 && b.y + b.h > 1115))) {
        continue;
      }
      if (!buildings.some((o) => rectsOverlap(b, o, 4))) buildings.push(b);
    }
  }
}

function placeStreetProps(rng, props) {
  // Lamps, trees, benches and hydrants along the sidewalks of the grid.
  for (const rx of ROAD_XS) {
    for (let y = 90; y < SAND_Y - 60; y += randRange(rng, 150, 210)) {
      if (ROAD_YS.some((ry) => Math.abs(ry - y) < 110)) continue;
      const side = chance(rng, 0.5) ? -1 : 1;
      const kind = pickFrom(rng, ['lamp', 'tree', 'tree', 'bench', 'hydrant', 'lamp']);
      props.push({ kind, x: rx + side * (ROAD_W / 2 + 16), y, r: kind === 'tree' ? 15 : 7 });
    }
  }
  for (const ry of ROAD_YS) {
    for (let x = 120; x < WORLD_W - 80; x += randRange(rng, 170, 240)) {
      if (ROAD_XS.some((rx) => Math.abs(rx - x) < 110)) continue;
      const side = chance(rng, 0.5) ? -1 : 1;
      const kind = pickFrom(rng, ['lamp', 'palm', 'bench', 'tree', 'hydrant']);
      props.push({ kind, x, y: ry + side * (ROAD_W / 2 + 16), r: kind === 'tree' ? 15 : 8 });
    }
  }
}

function placeBeachProps(rng, props) {
  // Palms along the promenade, then towels and umbrellas on the sand.
  for (let x = 70; x < WORLD_W - 60; x += randRange(rng, 120, 190)) {
    props.push({ kind: 'palm', x, y: 3346 + randRange(rng, -8, 10), r: 13 });
  }
  for (let i = 0; i < 90; i++) {
    const kind = chance(rng, 0.45) ? 'umbrella' : 'towel';
    props.push({ kind, x: randRange(rng, 60, WORLD_W - 60), y: randRange(rng, 3420, SEA_Y - 26),
      r: 11, color: pickFrom(rng, ['#e2574c', '#3f8fbf', '#f2b33d', '#57a773', '#e58ec0']) });
  }
  // Moored boats bobbing just off the marina shore.
  for (let i = 0; i < 9; i++) {
    props.push({ kind: 'boat', x: 1850 + i * 165 + randRange(rng, -20, 20),
      y: SEA_Y + randRange(rng, 46, 130), r: 20, phase: randRange(rng, 0, 6) });
  }
}

function placeHarbourProps(rng, props) {
  for (let i = 0; i < 4; i++) {
    props.push({ kind: 'crane', x: 240 + i * 380, y: 2520 + (i % 2) * 330, r: 30 });
  }
  for (let i = 0; i < 26; i++) {
    props.push({ kind: 'barrel', x: randRange(rng, 80, 1600), y: randRange(rng, 1850, 3220), r: 8 });
  }
}

const STALL_COLORS = ['#d94f3d', '#2e7fb8', '#e8a13a', '#4d9e6b', '#8e5bb5', '#d96ba0'];

function placeMarketStalls(rng, stalls, buildings) {
  // Two stall rows flank the market road, awnings facing the street, so the
  // road itself stays open between them for crowds and the courier's route.
  const streetY = 1030;
  for (let x = 3560; x < 5050; x += 118) {
    for (const dy of [-118, 118]) {
      const stall = { x, y: streetY + dy - 21, w: 96, h: 42,
        color: STALL_COLORS[stalls.length % STALL_COLORS.length] };
      if (!buildings.some((b) => rectsOverlap(stall, b, 2))) stalls.push(stall);
    }
  }
}

// --- geometry questions -------------------------------------------------

export function isOnRoad(x, y) {
  if (y > SAND_Y + 40) return false;
  for (const rx of ROAD_XS) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of ROAD_YS) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  const b = BOULEVARD;
  const len2 = (b.x2 - b.x1) ** 2 + (b.y2 - b.y1) ** 2;
  const t = Math.max(0, Math.min(1, ((x - b.x1) * (b.x2 - b.x1) + (y - b.y1) * (b.y2 - b.y1)) / len2));
  const px = b.x1 + t * (b.x2 - b.x1);
  const py = b.y1 + t * (b.y2 - b.y1);
  return Math.hypot(x - px, y - py) < b.w / 2;
}

export function pointInRect(px, py, r, pad) {
  return px > r.x - pad && px < r.x + r.w + pad && py > r.y - pad && py < r.y + r.h + pad;
}

export function solidsNear(city, x, y, range) {
  const out = [];
  for (const b of city.buildings) {
    if (b.x - range < x && b.x + b.w + range > x && b.y - range < y && b.y + b.h + range > y) out.push(b);
  }
  for (const s of city.stalls) {
    if (s.x - range < x && s.x + s.w + range > x && s.y - range < y && s.y + s.h + range > y) out.push(s);
  }
  return out;
}

// Push a circle (x, y, r) out of every solid it overlaps; reports contact.
export function collideCircle(city, x, y, r) {
  let hit = false;
  for (const b of solidsNear(city, x, y, r + 4)) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx;
    const dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        y = ny + (dy / d) * r;
      } else {
        // Centre inside the rect: leave by the shallowest side.
        const left = x - b.x;
        const right = b.x + b.w - x;
        const top = y - b.y;
        const bottom = b.y + b.h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = b.x - r;
        else if (m === right) x = b.x + b.w + r;
        else if (m === top) y = b.y - r;
        else y = b.y + b.h + r;
      }
    }
  }
  x = Math.max(r, Math.min(WORLD_W - r, x));
  y = Math.max(r, Math.min(SEA_Y - 6 - r, y));
  return { x, y, hit };
}

export function lineBlocked(city, ax, ay, bx, by) {
  // Cheap sight test: sample the segment against building rects.
  const steps = 14;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    for (const b of city.buildings) {
      if (pointInRect(x, y, b, 0)) return true;
    }
  }
  return false;
}
