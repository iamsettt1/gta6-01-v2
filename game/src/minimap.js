// minimap.js — the HUD minimap: district tints, the road grid, the sea,
// the player arrow, police blips, the mission beacon, race checkpoints and
// the safehouse, all in one small panel in the corner of the screen.

import { WORLD_W, WORLD_H, SEA_Y, DISTRICTS } from './config.js';
import { currentObjective } from './missions.js';
import { RACE_COURSES } from './activities.js';

export const MAP_W = 196;
export const MAP_H = 146;

export function drawMinimap(ctx, G, x, y, time) {
  const sx = MAP_W / WORLD_W;
  const sy = MAP_H / WORLD_H;
  ctx.save();
  // Panel.
  ctx.fillStyle = 'rgba(16,20,26,0.82)';
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, x - 6, y - 6, MAP_W + 12, MAP_H + 12, 8);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(x, y, MAP_W, MAP_H);
  ctx.clip();
  // Districts and sea.
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.ground;
    ctx.fillRect(x + d.x * sx, y + d.y * sy, d.w * sx, d.h * sy);
  }
  ctx.fillStyle = '#3d7ea6';
  ctx.fillRect(x, y + SEA_Y * sy, MAP_W, (WORLD_H - SEA_Y) * sy);
  // Roads.
  ctx.strokeStyle = 'rgba(70,70,78,0.85)';
  ctx.lineWidth = 2;
  for (const rx of G.city.roadXs) {
    ctx.beginPath();
    ctx.moveTo(x + rx * sx, y);
    ctx.lineTo(x + rx * sx, y + MAP_H);
    ctx.stroke();
  }
  for (const ry of G.city.roadYs) {
    ctx.beginPath();
    ctx.moveTo(x, y + ry * sy);
    ctx.lineTo(x + MAP_W, y + ry * sy);
    ctx.stroke();
  }
  const b = G.city.boulevard;
  ctx.beginPath();
  ctx.moveTo(x + b.x1 * sx, y + b.y1 * sy);
  ctx.lineTo(x + b.x2 * sx, y + b.y2 * sy);
  ctx.stroke();

  const dot = (wx, wy, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + wx * sx, y + wy * sy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  // Race starts and the safehouse.
  for (const course of RACE_COURSES) dot(course.points[0][0], course.points[0][1], '#51cf66', 2.6);
  dot(G.city.safehouse.x, G.city.safehouse.y, '#ffffff', 3);
  ctx.fillStyle = '#20242a';
  ctx.font = '700 6px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('H', x + G.city.safehouse.x * sx, y + G.city.safehouse.y * sy + 2);

  // The objective beacon.
  const obj = currentObjective(G);
  if (obj) {
    const pulse = 2.6 + Math.sin(time * 5) * 1.1;
    dot(obj.x, obj.y, '#ffd43b', pulse + 1.6);
    dot(obj.x, obj.y, '#fff3bf', pulse * 0.55);
  }
  // Police blips flash red and blue.
  const flash = Math.floor(time * 4) % 2 === 0;
  for (const c of G.policeCars) dot(c.x, c.y, flash ? '#ff4d4d' : '#4d7bff', 2.6);
  for (const o of G.officers) dot(o.x, o.y, flash ? '#ff4d4d' : '#4d7bff', 2);
  // The player arrow.
  const p = G.player;
  ctx.save();
  ctx.translate(x + p.x * sx, y + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#20242a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(6.4, 0);
  ctx.lineTo(-4.4, -4);
  ctx.lineTo(-4.4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.restore();

  // North arrow.
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', x + MAP_W - 4, y - 10);
  ctx.beginPath();
  ctx.moveTo(x + MAP_W - 4, y - 20);
  ctx.lineTo(x + MAP_W - 7.4, y - 14);
  ctx.lineTo(x + MAP_W - 0.6, y - 14);
  ctx.closePath();
  ctx.fill();
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
