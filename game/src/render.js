// render.js — everything the player sees: the sunlit city (districts, roads,
// buildings with rooftops and shadows, props, the animated sea), every
// vehicle and person, effects, the objective beacon, and the full HUD
// (minimap, stars, health, weapon, speed, clock, objective, race data).

import { VIEW_W, VIEW_H, WORLD_W, WORLD_H, SAND_Y, SEA_Y, DISTRICTS, SAFEHOUSE_NAME } from './config.js';
import { clamp, distanceBetween } from './random.js';
import { ROAD_W } from './city.js';
import { drawCar } from './vehicles.js';
import { drawPedestrian } from './pedestrians.js';
import { drawOfficer } from './police.js';
import { drawPickup } from './combat.js';
import { drawSkids, drawParticles, drawPopups, dayTint, formatClock, isDusk } from './effects.js';
import { drawMinimap, MAP_W } from './minimap.js';
import { currentObjective, currentStage, missionChecklist } from './missions.js';
import { drawDisc, playerRacePosition, formatRaceTime, RACE_COURSES } from './activities.js';
import { respectLevel } from './world.js';

function viewBounds(G) {
  const cam = G.camera;
  const hw = VIEW_W / cam.zoom / 2 + 80;
  const hh = VIEW_H / cam.zoom / 2 + 80;
  return { x0: cam.x - hw, y0: cam.y - hh, x1: cam.x + hw, y1: cam.y + hh };
}

function inView(v, x, y, pad) {
  return x > v.x0 - pad && x < v.x1 + pad && y > v.y0 - pad && y < v.y1 + pad;
}

export function renderGame(ctx, G) {
  const cam = G.camera;
  const v = viewBounds(G);
  const shakeX = cam.shake ? (Math.random() - 0.5) * cam.shake : 0;
  const shakeY = cam.shake ? (Math.random() - 0.5) * cam.shake : 0;
  ctx.save();
  ctx.translate(VIEW_W / 2, VIEW_H / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x + shakeX, -cam.y + shakeY);

  drawGround(ctx, G, v);
  drawRoads(ctx, G, v);
  drawStalls(ctx, G, v);
  drawSkids(ctx, G.fx);
  for (const d of G.discs) if (inView(v, d.x, d.y, 30)) drawDisc(ctx, d, G.time);
  for (const pk of G.pickups) if (inView(v, pk.x, pk.y, 30)) drawPickup(ctx, pk, G.time);
  drawDropped(ctx, G, v);
  drawGroundProps(ctx, G, v);
  drawBuildings(ctx, G, v);
  drawTallProps(ctx, G, v);
  drawBeacon(ctx, G);
  drawRaceMarkers(ctx, G, v);
  for (const car of G.cars) if (inView(v, car.x, car.y, 70)) drawCar(ctx, car, G.time);
  for (const car of G.policeCars) if (inView(v, car.x, car.y, 70)) drawCar(ctx, car, G.time);
  for (const ped of G.peds) if (inView(v, ped.x, ped.y, 30)) drawPedestrian(ctx, ped, G.time);
  for (const o of G.officers) if (inView(v, o.x, o.y, 30)) drawOfficer(ctx, o, G.time);
  if (!G.player.car) drawPlayer(ctx, G);
  drawParticles(ctx, G.fx);
  drawPopups(ctx, G.fx);
  drawMuzzleFlash(ctx, G);
  ctx.restore();

  // The day's light washes over everything, then the HUD.
  const tint = dayTint(G.clockMin);
  ctx.fillStyle = `rgba(${tint.color},${tint.alpha})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (G.screen === 'play' || G.screen === 'board' || G.screen === 'pause') drawHUD(ctx, G);
}

// --- the city -----------------------------------------------------------------

function drawGround(ctx, G, v) {
  ctx.fillStyle = '#c8bd9d';
  ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  for (const d of DISTRICTS) {
    if (d.x + d.w < v.x0 || d.x > v.x1 || d.y + d.h < v.y0 || d.y > v.y1) continue;
    ctx.fillStyle = d.ground;
    ctx.fillRect(d.x, d.y, d.w, d.h);
  }
  // Sand, then the promenade boards, then the animated sea.
  ctx.fillStyle = '#f0dcae';
  ctx.fillRect(0, SAND_Y, WORLD_W, SEA_Y - SAND_Y);
  ctx.fillStyle = '#d9c491';
  ctx.fillRect(0, 3312, WORLD_W, 52);
  ctx.strokeStyle = 'rgba(160,130,80,0.5)';
  ctx.lineWidth = 2;
  for (let x = 0; x < WORLD_W; x += 46) {
    ctx.beginPath();
    ctx.moveTo(x, 3314);
    ctx.lineTo(x, 3362);
    ctx.stroke();
  }
  const seaGrad = ctx.createLinearGradient(0, SEA_Y, 0, WORLD_H);
  seaGrad.addColorStop(0, '#4d94c4');
  seaGrad.addColorStop(1, '#2c5f8a');
  ctx.fillStyle = seaGrad;
  ctx.fillRect(0, SEA_Y, WORLD_W, WORLD_H - SEA_Y);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2.4;
  for (let row = 0; row < 7; row++) {
    const y = SEA_Y + 22 + row * 32;
    if (y < v.y0 || y > v.y1) continue;
    ctx.beginPath();
    for (let x = Math.max(0, v.x0); x < Math.min(WORLD_W, v.x1); x += 64) {
      const yy = y + Math.sin(x * 0.012 + G.time * 1.6 + row * 1.7) * 4;
      if (x === Math.max(0, v.x0)) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = Math.max(0, v.x0); x < Math.min(WORLD_W, v.x1); x += 40) {
    const yy = SEA_Y + 3 + Math.sin(x * 0.02 + G.time * 2.2) * 2.6;
    if (x === Math.max(0, v.x0)) ctx.moveTo(x, yy);
    else ctx.lineTo(x, yy);
  }
  ctx.stroke();
}

function drawRoads(ctx, G, v) {
  const city = G.city;
  ctx.fillStyle = '#c9bda6';
  for (const rx of city.roadXs) ctx.fillRect(rx - ROAD_W / 2 - 13, 0, ROAD_W + 26, SAND_Y + 30);
  for (const ry of city.roadYs) ctx.fillRect(0, ry - ROAD_W / 2 - 13, WORLD_W, ROAD_W + 26);
  ctx.fillStyle = '#45454e';
  for (const rx of city.roadXs) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, SAND_Y + 30);
  for (const ry of city.roadYs) ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
  // The diagonal boulevard.
  const b = city.boulevard;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#c9bda6';
  ctx.lineWidth = b.w + 26;
  ctx.beginPath();
  ctx.moveTo(b.x1, b.y1);
  ctx.lineTo(b.x2, b.y2);
  ctx.stroke();
  ctx.strokeStyle = '#45454e';
  ctx.lineWidth = b.w;
  ctx.beginPath();
  ctx.moveTo(b.x1, b.y1);
  ctx.lineTo(b.x2, b.y2);
  ctx.stroke();
  // Centre dashes.
  ctx.strokeStyle = 'rgba(240,235,215,0.75)';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  for (const rx of city.roadXs) {
    ctx.beginPath();
    ctx.moveTo(rx, Math.max(0, v.y0));
    ctx.lineTo(rx, Math.min(SAND_Y + 30, v.y1));
    ctx.stroke();
  }
  for (const ry of city.roadYs) {
    ctx.beginPath();
    ctx.moveTo(Math.max(0, v.x0), ry);
    ctx.lineTo(Math.min(WORLD_W, v.x1), ry);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(b.x1, b.y1);
  ctx.lineTo(b.x2, b.y2);
  ctx.stroke();
  ctx.setLineDash([]);
  // Crosswalks at every grid intersection.
  ctx.fillStyle = 'rgba(240,240,235,0.55)';
  for (const rx of city.roadXs) {
    for (const ry of city.roadYs) {
      if (!inView(v, rx, ry, 130)) continue;
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(rx + i * 24 - 8, ry - ROAD_W / 2 - 20, 15, 13);
        ctx.fillRect(rx + i * 24 - 8, ry + ROAD_W / 2 + 7, 15, 13);
        ctx.fillRect(rx - ROAD_W / 2 - 20, ry + i * 24 - 8, 13, 15);
        ctx.fillRect(rx + ROAD_W / 2 + 7, ry + i * 24 - 8, 13, 15);
      }
    }
  }
}

function drawStalls(ctx, G, v) {
  for (const s of G.city.stalls) {
    if (!inView(v, s.x + s.w / 2, s.y + s.h / 2, 80)) continue;
    ctx.fillStyle = 'rgba(40,30,20,0.22)';
    ctx.fillRect(s.x + 4, s.y + 6, s.w, s.h);
    ctx.fillStyle = '#8a6a48';
    ctx.fillRect(s.x, s.y + 12, s.w, s.h - 12);
    // Striped awning.
    const stripeW = s.w / 6;
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 === 0 ? s.color : '#f6efdd';
      ctx.fillRect(s.x + i * stripeW, s.y, stripeW, 15);
    }
    ctx.fillStyle = 'rgba(60,40,20,0.55)';
    ctx.fillRect(s.x + 8, s.y + 24, s.w - 16, 5);
    ctx.fillStyle = '#e8a13a';
    ctx.fillRect(s.x + 14, s.y + 17, 12, 6);
    ctx.fillStyle = '#57a773';
    ctx.fillRect(s.x + 34, s.y + 17, 12, 6);
    ctx.fillStyle = '#d94f3d';
    ctx.fillRect(s.x + 54, s.y + 17, 12, 6);
  }
}

function drawDropped(ctx, G, v) {
  for (const d of G.dropped) {
    if (!inView(v, d.x, d.y, 20)) continue;
    ctx.fillStyle = d.kind === 'box' ? '#b08954' : d.kind === 'cup' ? '#ffffff' : '#e8e3d8';
    ctx.fillRect(d.x - 5, d.y - 4, 10, 8);
  }
}

function drawGroundProps(ctx, G, v) {
  for (const prop of G.city.props) {
    if (!inView(v, prop.x, prop.y, 40)) continue;
    if (prop.kind === 'towel') {
      ctx.save();
      ctx.translate(prop.x, prop.y);
      ctx.rotate(((prop.x * 7) % 10) / 10 - 0.5);
      ctx.fillStyle = prop.color;
      ctx.fillRect(-13, -7, 26, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(-13, -2, 26, 4);
      ctx.restore();
    } else if (prop.kind === 'bench') {
      ctx.fillStyle = '#8a6a48';
      ctx.fillRect(prop.x - 13, prop.y - 4, 26, 8);
      ctx.fillStyle = '#6e543a';
      ctx.fillRect(prop.x - 13, prop.y - 7, 26, 3);
    } else if (prop.kind === 'barrel') {
      ctx.fillStyle = '#7a5c38';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5d452a';
      ctx.stroke();
    } else if (prop.kind === 'hydrant') {
      ctx.fillStyle = '#d94f3d';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawTallProps(ctx, G, v) {
  const dusk = isDusk(G.clockMin);
  for (const prop of G.city.props) {
    if (!inView(v, prop.x, prop.y, 90)) continue;
    if (prop.kind === 'tree') {
      ctx.fillStyle = '#7a5c38';
      ctx.fillRect(prop.x - 2.4, prop.y - 2, 4.8, 9);
      ctx.fillStyle = '#4d7c4f';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y - 6, 14, 0, Math.PI * 2);
      ctx.arc(prop.x - 9, prop.y + 1, 10, 0, Math.PI * 2);
      ctx.arc(prop.x + 9, prop.y + 1, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.arc(prop.x - 4, prop.y - 10, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.kind === 'palm') {
      ctx.strokeStyle = '#8a6a48';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(prop.x, prop.y + 6);
      ctx.quadraticCurveTo(prop.x + 3, prop.y - 8, prop.x + 7, prop.y - 16);
      ctx.stroke();
      ctx.strokeStyle = '#3f8f4f';
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.moveTo(prop.x + 7, prop.y - 16);
        ctx.quadraticCurveTo(
          prop.x + 7 + Math.cos(a) * 12, prop.y - 16 + Math.sin(a) * 7 - 4,
          prop.x + 7 + Math.cos(a) * 19, prop.y - 16 + Math.sin(a) * 10 + 5);
        ctx.stroke();
      }
    } else if (prop.kind === 'lamp') {
      ctx.fillStyle = '#3c4148';
      ctx.fillRect(prop.x - 1.6, prop.y - 12, 3.2, 14);
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y - 14, 3.6, 0, Math.PI * 2);
      ctx.fill();
      if (dusk) {
        ctx.fillStyle = 'rgba(255,220,140,0.16)';
        ctx.beginPath();
        ctx.arc(prop.x, prop.y - 12, 26, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (prop.kind === 'umbrella') {
      ctx.fillStyle = '#8a6a48';
      ctx.fillRect(prop.x - 1.2, prop.y - 4, 2.4, 12);
      ctx.fillStyle = prop.color;
      ctx.beginPath();
      ctx.moveTo(prop.x - 15, prop.y - 3);
      ctx.lineTo(prop.x, prop.y - 15);
      ctx.lineTo(prop.x + 15, prop.y - 3);
      ctx.closePath();
      ctx.fill();
    } else if (prop.kind === 'boat') {
      const bob = Math.sin(G.time * 1.4 + prop.phase) * 2.4;
      ctx.save();
      ctx.translate(prop.x, prop.y + bob);
      ctx.fillStyle = '#f2ead8';
      ctx.beginPath();
      ctx.ellipse(0, 0, 21, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8a6a48';
      ctx.fillRect(-1.4, -17, 2.8, 17);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.moveTo(2, -16);
      ctx.lineTo(2, -2);
      ctx.lineTo(13, -2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (prop.kind === 'crane') {
      ctx.strokeStyle = '#d97c2b';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(prop.x, prop.y + 26);
      ctx.lineTo(prop.x, prop.y - 44);
      ctx.lineTo(prop.x + 62, prop.y - 44);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#5d6066';
      ctx.beginPath();
      ctx.moveTo(prop.x + 48, prop.y - 44);
      ctx.lineTo(prop.x + 48, prop.y - 18);
      ctx.stroke();
      ctx.fillStyle = '#7a7e85';
      ctx.fillRect(prop.x + 40, prop.y - 18, 16, 12);
    }
  }
}

// Scale a #rrggbb colour toward black (f<1) or white (f>1).
function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

function drawBuildings(ctx, G, v) {
  const list = G.city.buildings.filter((b) => inView(v, b.x + b.w / 2, b.y + b.h / 2, 260));
  list.sort((a, b) => a.y - b.y);
  for (const b of list) {
    const lift = 3 + b.floors * 2.2;
    if (b.garden) {
      ctx.fillStyle = '#8fae6b';
      ctx.fillRect(b.x - 8, b.y - 8, b.w + 16, b.h + 16);
    }
    ctx.fillStyle = 'rgba(43,32,20,0.20)';
    ctx.fillRect(b.x + lift, b.y + lift + 3, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // The roof keeps the wall's hue, shaded down, so districts read in
    // their own palettes instead of one grey-brown everywhere.
    ctx.fillStyle = b.kind === 'container' ? b.roof : shadeHex(b.color, 0.8);
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    ctx.fillStyle = b.kind === 'container' ? 'rgba(255,255,255,0.10)' : shadeHex(b.color, 0.92);
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, 7);
    ctx.strokeStyle = 'rgba(60,45,30,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    const hash = Math.abs(Math.floor(b.x * 7 + b.y * 13)) % 5;
    if (b.kind === 'tower') {
      ctx.fillStyle = 'rgba(38,54,68,0.55)';
      const cols = Math.floor(b.w / 17);
      const rows = Math.floor(b.h / 17);
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if ((i * 3 + j * 7 + hash) % 3 === 0) continue;
          ctx.fillRect(b.x + 10 + i * 17, b.y + 10 + j * 17, 9, 9);
        }
      }
      if (b.floors >= 7) {
        ctx.fillStyle = '#9aa0a6';
        ctx.beginPath();
        ctx.arc(b.x + b.w - 20, b.y + 20, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (b.kind === 'container') {
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 2;
      for (let x = b.x + 12; x < b.x + b.w - 6; x += 13) {
        ctx.beginPath();
        ctx.moveTo(x, b.y + 5);
        ctx.lineTo(x, b.y + b.h - 5);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = 'rgba(90,85,78,0.8)';
      ctx.fillRect(b.x + 12 + hash * 9, b.y + 12, 15, 11);
      if (hash % 2 === 0) ctx.fillRect(b.x + b.w - 30, b.y + b.h - 26, 13, 10);
    }
    if (b.name) {
      ctx.font = '700 12.5px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const tw = ctx.measureText(b.name).width + 14;
      ctx.fillStyle = 'rgba(20,22,28,0.78)';
      ctx.beginPath();
      ctx.roundRect(b.x + b.w / 2 - tw / 2, b.y - 24, tw, 18, 5);
      ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(b.name, b.x + b.w / 2, b.y - 11);
    }
  }
}

function drawBeacon(ctx, G) {
  const obj = currentObjective(G);
  if (!obj || G.screen !== 'play') return;
  const pulse = 0.5 + Math.sin(G.time * 4.4) * 0.5;
  ctx.save();
  const grad = ctx.createLinearGradient(0, obj.y - 210, 0, obj.y);
  grad.addColorStop(0, 'rgba(255,212,59,0)');
  grad.addColorStop(1, `rgba(255,212,59,${0.24 + pulse * 0.14})`);
  ctx.fillStyle = grad;
  ctx.fillRect(obj.x - 13, obj.y - 210, 26, 210);
  ctx.strokeStyle = `rgba(255,212,59,${0.65 + pulse * 0.35})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(obj.x, obj.y, 30 + pulse * 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffd43b';
  ctx.save();
  ctx.translate(obj.x, obj.y - 40 - pulse * 6);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-7, -7, 14, 14);
  ctx.restore();
  ctx.restore();
}

function drawRaceMarkers(ctx, G, v) {
  if (G.race) {
    const race = G.race;
    race.points.forEach(([x, y], i) => {
      if (i < race.playerCp) return;
      const isNext = i === race.playerCp;
      ctx.strokeStyle = isNext ? '#ffd43b' : 'rgba(81,207,102,0.7)';
      ctx.lineWidth = isNext ? 5 : 3;
      ctx.beginPath();
      ctx.arc(x, y, isNext ? 44 + Math.sin(G.time * 5) * 5 : 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 19px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), x, y + 7);
    });
    return;
  }
  // Idle race starts invite the player in: a green ring and a flag.
  for (const course of RACE_COURSES) {
    const [x, y] = course.points[0];
    if (!inView(v, x, y, 70)) continue;
    ctx.strokeStyle = 'rgba(81,207,102,0.85)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, 40 + Math.sin(G.time * 3.4) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#51cf66';
    ctx.fillRect(x - 1.6, y - 34, 3.2, 30);
    ctx.beginPath();
    ctx.moveTo(x + 1.6, y - 34);
    ctx.lineTo(x + 19, y - 27);
    ctx.lineTo(x + 1.6, y - 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 11.5px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RACE', x, y + 52);
  }
}

// --- the player -----------------------------------------------------------------

function drawPlayer(ctx, G) {
  const p = G.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(40,30,20,0.28)';
  ctx.beginPath();
  ctx.ellipse(1.5, 3, 10, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  const swing = p.speed > 4 ? Math.sin(p.walkPhase * 6) * 5 : 0;
  ctx.rotate(p.angle + Math.PI / 2);
  ctx.strokeStyle = '#2d3436';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-3.4, 3);
  ctx.lineTo(-3.4 + swing * 0.4, 9.4);
  ctx.moveTo(3.4, 3);
  ctx.lineTo(3.4 - swing * 0.4, 9.4);
  ctx.stroke();
  ctx.fillStyle = '#0e7c7b';
  ctx.beginPath();
  ctx.ellipse(0, 0, 7.8, 9.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0e7c7b';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(7.4, -2);
  ctx.lineTo(10.4, 3.4);
  ctx.stroke();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(0, -1.5, 5.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e63946';
  ctx.beginPath();
  ctx.arc(0, -2.4, 6.1, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // The gun comes up when the mouse is held.
  if (G.input.mouseDown || G.arsenal.flashT > 0) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#20242a';
    ctx.fillRect(8, -2, 13, 4.4);
    ctx.restore();
  }
}

function drawMuzzleFlash(ctx, G) {
  const ars = G.arsenal;
  if (ars.flashT <= 0 || G.player.car) return;
  const p = G.player;
  const mx = p.x + Math.cos(ars.flashAngle) * 24;
  const my = p.y + Math.sin(ars.flashAngle) * 24;
  ctx.save();
  ctx.translate(mx, my);
  ctx.rotate(ars.flashAngle);
  ctx.fillStyle = '#ffd43b';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const r = i % 2 === 0 ? 15 : 6;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff3bf';
  ctx.beginPath();
  ctx.arc(0, 0, 5.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// --- the HUD ----------------------------------------------------------------------

function star(ctx, cx, cy, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = '#ffd43b';
    ctx.fill();
  }
  ctx.strokeStyle = filled ? '#e8a13a' : 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function bar(ctx, x, y, w, h, ratio, color, label) {
  ctx.fillStyle = 'rgba(14,16,20,0.78)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 5);
  ctx.fill();
  ctx.fillStyle = color;
  if (ratio > 0.01) {
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, (w - 4) * clamp(ratio, 0, 1), h - 4, 4);
    ctx.fill();
  }
  if (label) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 10.5px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 7, y + h - 4.5);
  }
}

function drawHUD(ctx, G) {
  const p = G.player;
  drawMinimap(ctx, G, 16, 30, G.time);

  // Objective banner, top centre.
  const obj = currentObjective(G);
  const stage = currentStage(G);
  let objText = obj.text;
  if (stage && stage.time && G.mission.active && stage.type === 'drive') {
    objText += ` · ${formatRaceTime(Math.max(0, G.mission.stageT))}`;
  }
  const dist = Math.round(distanceBetween(p.x, p.y, obj.x, obj.y));
  ctx.font = '700 15.5px system-ui, sans-serif';
  const tw = Math.min(560, ctx.measureText(objText).width + 108);
  ctx.fillStyle = 'rgba(14,16,20,0.8)';
  ctx.beginPath();
  ctx.roundRect((VIEW_W - tw) / 2, 14, tw, 40, 9);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,212,59,0.6)';
  ctx.stroke();
  ctx.fillStyle = '#ffd43b';
  ctx.font = '900 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(G.mission.active ? `MISSION · ${G.mission.active.name.toUpperCase()}` : 'OBJECTIVE',
    (VIEW_W - tw) / 2 + 14, 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 14.5px system-ui, sans-serif';
  ctx.fillText(objText, (VIEW_W - tw) / 2 + 14, 48, tw - 96);
  ctx.fillStyle = '#ffd43b';
  ctx.textAlign = 'right';
  ctx.fillText(`${dist}m`, (VIEW_W + tw) / 2 - 12, 48);

  // Stars, clock and cash, top right.
  for (let i = 0; i < 5; i++) {
    const filled = i < G.wanted.level;
    const blink = filled && i === G.wanted.level - 1 && G.wanted.quiet > 4 &&
      Math.floor(G.time * 3) % 2 === 0;
    ctx.save();
    if (blink) ctx.globalAlpha = 0.35;
    star(ctx, VIEW_W - 30 - i * 31, 34, 12.5, filled);
    ctx.restore();
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 19px system-ui, sans-serif';
  ctx.fillText(formatClock(G.clockMin), VIEW_W - 16, 76);
  ctx.fillStyle = '#51cf66';
  ctx.font = '900 21px system-ui, sans-serif';
  ctx.fillText(`$${G.cash.toLocaleString('en-US')}`, VIEW_W - 16, 102);
  ctx.fillStyle = '#e8e3d8';
  ctx.font = '700 12.5px system-ui, sans-serif';
  ctx.fillText(`RESPECT LV ${respectLevel(G)} · MISSIONS ${G.progress.missionsDone}/8`, VIEW_W - 16, 122);

  // Health and weapon, bottom left.
  bar(ctx, 16, VIEW_H - 58, 226, 19, p.hp / 100, p.hp > 30 ? '#51cf66' : '#ff6b5e', 'HEALTH');
  const ars = G.arsenal;
  const wname = ars.current === 'pistol' ? 'PISTOL' : 'SCATTERGUN';
  ctx.fillStyle = 'rgba(14,16,20,0.78)';
  ctx.beginPath();
  ctx.roundRect(16, VIEW_H - 34, 226, 24, 6);
  ctx.fill();
  ctx.fillStyle = '#ffd9a0';
  ctx.font = '800 13.5px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${wname} · ${ars[ars.current].ammo}`, 26, VIEW_H - 18);
  ctx.fillStyle = '#9aa4ad';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Q — switch', 234, VIEW_H - 18);

  // Speed and vehicle health, bottom right.
  if (p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.42);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 40px system-ui, sans-serif';
    ctx.fillText(String(kmh), VIEW_W - 66, VIEW_H - 22);
    ctx.fillStyle = '#9aa4ad';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText('km/h', VIEW_W - 16, VIEW_H - 22);
    bar(ctx, VIEW_W - 242, VIEW_H - 58, 226, 15, p.car.hp / p.car.maxHp, '#74c0fc', 'CAR');
  }

  drawMissionPanels(ctx, G);
  drawRaceHUD(ctx, G);
  drawHint(ctx, G);

  if (p.hurtT > 0 || p.hp < 26) {
    const a = p.hurtT > 0 ? 0.22 : 0.13 + Math.sin(G.time * 4) * 0.04;
    const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 260, VIEW_W / 2, VIEW_H / 2, 720);
    grad.addColorStop(0, 'rgba(200,30,40,0)');
    grad.addColorStop(1, `rgba(200,30,40,${a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function drawMissionPanels(ctx, G) {
  const m = G.mission;
  const stage = currentStage(G);
  // Tail-mission detection meter.
  if (m.active && stage && stage.type === 'tail') {
    const w = 300;
    const x = (VIEW_W - w) / 2;
    const y = VIEW_H - 108;
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DETECTION', VIEW_W / 2, y - 6);
    bar(ctx, x, y, w, 14, m.detection, m.detection > 0.62 ? '#ff6b5e' : '#ffd43b');
    if (m.loseT > 0.4) {
      ctx.fillStyle = '#ff8a75';
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillText('LOSING THE COURIER…', VIEW_W / 2, y + 32);
    }
  }
  // Robbery progress.
  if (m.active && stage && stage.type === 'rob') {
    const ratio = 1 - clamp(m.stageT / stage.time, 0, 1);
    bar(ctx, (VIEW_W - 300) / 2, VIEW_H - 108, 300, 14, ratio, '#51cf66', 'EMPTYING THE TILL…');
  }
  // Arrest progress.
  if (G.bustProgress > 0.04) {
    bar(ctx, (VIEW_W - 300) / 2, 76, 300, 15, G.bustProgress, '#ff6b5e', 'ARREST IN PROGRESS — RUN!');
  }
  // The shootout checklist.
  const list = missionChecklist(G);
  if (list) {
    const x = VIEW_W - 306;
    const y = 150;
    ctx.fillStyle = 'rgba(14,16,20,0.82)';
    ctx.beginPath();
    ctx.roundRect(x, y, 290, 26 + list.length * 24, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,212,59,0.5)';
    ctx.stroke();
    ctx.fillStyle = '#ffd43b';
    ctx.font = '900 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('HARBOUR OF SCORPIONS', x + 14, y + 19);
    list.forEach((item, i) => {
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillStyle = item.done ? '#51cf66' : item.current ? '#ffffff' : '#9aa4ad';
      const mark = item.done ? '✓' : item.current ? '▶' : '·';
      ctx.fillText(`${mark} ${item.label}`, x + 14, y + 44 + i * 24);
    });
  }
}

function drawRaceHUD(ctx, G) {
  const race = G.race;
  if (!race) return;
  ctx.textAlign = 'center';
  if (race.state === 'countdown') {
    ctx.font = '900 96px system-ui, sans-serif';
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(14,12,8,0.85)';
    const label = String(Math.max(1, Math.ceil(race.t)));
    ctx.strokeText(label, VIEW_W / 2, VIEW_H / 2 - 60);
    ctx.fillStyle = '#ffd43b';
    ctx.fillText(label, VIEW_W / 2, VIEW_H / 2 - 60);
    return;
  }
  const pos = playerRacePosition(G);
  ctx.fillStyle = 'rgba(14,16,20,0.8)';
  ctx.beginPath();
  ctx.roundRect(VIEW_W / 2 - 170, 62, 340, 38, 9);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 16px system-ui, sans-serif';
  ctx.fillText(`${race.name} · POS ${pos}/3 · CHECKPOINT ${Math.min(race.playerCp + 1, race.points.length)}/${race.points.length} · ${formatRaceTime(race.runT)}`,
    VIEW_W / 2, 87);
}

function drawHint(ctx, G) {
  if (G.screen !== 'play' || G.mission.cardT > 0) return;
  const p = G.player;
  let hint = '';
  if (p.car) {
    hint = 'E — get out · Space — handbrake';
    if (!G.race) {
      for (let i = 0; i < 3; i++) {
        const s = { x: [700, 420, 420][i], y: [2980, 380, 2330][i] };
        if (distanceBetween(p.x, p.y, s.x, s.y) < 120) hint = 'R — start the race';
      }
    }
  } else {
    let nearCar = false;
    for (const car of G.cars) {
      if (distanceBetween(p.x, p.y, car.x, car.y) < 56) nearCar = true;
    }
    if (nearCar) hint = 'E — steal this car';
    else if (distanceBetween(p.x, p.y, G.city.safehouse.x, G.city.safehouse.y) < 78) {
      hint = `${SAFEHOUSE_NAME} — your health returns here`;
    }
  }
  if (!hint) return;
  ctx.font = '700 14px system-ui, sans-serif';
  const w = ctx.measureText(hint).width + 28;
  ctx.fillStyle = 'rgba(14,16,20,0.72)';
  ctx.beginPath();
  ctx.roundRect((VIEW_W - w) / 2, VIEW_H - 40, w, 26, 7);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.textAlign = 'center';
  ctx.fillText(hint, VIEW_W / 2, VIEW_H - 22);
}
