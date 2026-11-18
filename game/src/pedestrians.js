// pedestrians.js — the people of Solmar Bay: spawning around the player,
// sidewalk wandering, crossing streets, strolling the promenade, fleeing
// from danger (sometimes dropping what they carry), and the little
// two-frame walk-cycle drawing.

import { randRange, pickFrom, chance, clamp } from './random.js';
import { collideCircle, isOnRoad } from './city.js';
import { SAND_Y, SEA_Y } from './config.js';

const SHIRTS = ['#e2574c', '#3f8fbf', '#f2b33d', '#57a773', '#e58ec0', '#7a6fc0',
  '#e8e3d8', '#4a6fa5', '#d96c33', '#2a9d8f', '#bc4749', '#f4f1de'];
const PANTS = ['#33404f', '#5b4a3f', '#71675c', '#2f4858', '#86615c', '#44546a'];
const SKINS = ['#f2c79b', '#e0ac82', '#c68863', '#a06a42', '#7c4a2d', '#ffdbac'];

let nextPedId = 1;

export function createPed(rng, x, y) {
  return {
    id: nextPedId++,
    x, y,
    angle: randRange(rng, 0, Math.PI * 2),
    speed: 0,
    cruise: randRange(rng, 42, 74),
    tx: x, ty: y,
    state: 'walk',          // walk | flee | down | stand
    stateT: 0,
    hp: 30,
    shirt: pickFrom(rng, SHIRTS),
    pants: pickFrom(rng, PANTS),
    skin: pickFrom(rng, SKINS),
    hat: chance(rng, 0.34),
    hatColor: pickFrom(rng, SHIRTS),
    walkPhase: randRange(rng, 0, 6),
    carries: chance(rng, 0.4) ? pickFrom(rng, ['bag', 'box', 'cup']) : null,
    target: false,          // mission tail target
    rival: false,
    name: '',
  };
}

function pickWanderTarget(G, ped) {
  const rng = G.rng;
  for (let tries = 0; tries < 6; tries++) {
    const a = randRange(rng, 0, Math.PI * 2);
    const d = randRange(rng, 90, 320);
    const x = ped.x + Math.cos(a) * d;
    const y = ped.y + Math.sin(a) * d;
    if (y > SEA_Y - 24) continue;
    const res = collideCircle(G.city, x, y, 12);
    if (!res.hit) {
      ped.tx = res.x;
      ped.ty = res.y;
      return;
    }
  }
  ped.tx = ped.x;
  ped.ty = ped.y;
}

export function updatePedestrians(G, dt) {
  const threat = G.threat;
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    ped.stateT += dt;
    let moveX = 0;
    let moveY = 0;
    let speed = ped.cruise;

    const distThreat = threat.active
      ? Math.hypot(ped.x - threat.x, ped.y - threat.y) : 9999;
    if (distThreat < 250 && ped.state !== 'flee') {
      ped.state = 'flee';
      ped.stateT = 0;
      if (ped.carries && chance(G.rng, 0.6)) {
        G.dropped.push({ x: ped.x, y: ped.y, kind: ped.carries, life: 0 });
        ped.carries = null;
      }
    }

    if (ped.state === 'flee') {
      const away = Math.atan2(ped.y - threat.y, ped.x - threat.x);
      moveX = Math.cos(away);
      moveY = Math.sin(away);
      speed = 178;
      if (ped.stateT > 2.6 || distThreat > 330) {
        ped.state = 'walk';
        pickWanderTarget(G, ped);
      }
    } else if (ped.target && G.mission.tailWalker) {
      // The tail-mission courier walks a steady route and never panics far.
      const w = G.mission.tailWalker;
      moveX = Math.cos(w.angle);
      moveY = Math.sin(w.angle);
      speed = 66;
      ped.angle = w.angle;
    } else {
      const dx = ped.tx - ped.x;
      const dy = ped.ty - ped.y;
      const d = Math.hypot(dx, dy);
      if (d < 14 || ped.stateT > 14) {
        if (chance(G.rng, 0.22)) {
          ped.state = 'stand';
          ped.stateT = 0;
        } else {
          pickWanderTarget(G, ped);
          ped.stateT = 0;
        }
      } else {
        moveX = dx / d;
        moveY = dy / d;
      }
      if (ped.state === 'stand') {
        moveX = 0;
        moveY = 0;
        if (ped.stateT > randRange(G.rng, 1.5, 3.5)) {
          ped.state = 'walk';
          pickWanderTarget(G, ped);
        }
      }
    }

    if (moveX !== 0 || moveY !== 0) {
      ped.angle = Math.atan2(moveY, moveX);
      const step = speed * dt;
      const res = collideCircle(G.city, ped.x + moveX * step, ped.y + moveY * step, 11);
      ped.x = res.x;
      ped.y = res.y;
      ped.walkPhase += dt * (speed / 16);
      ped.speed = speed;
    } else {
      ped.speed = 0;
    }
  }
}

// Keep a living crowd near the player: spawn on sidewalks and the beach,
// remove anyone who has wandered far away (never the mission target).
export function maintainCrowd(G) {
  const p = G.player;
  G.peds = G.peds.filter((ped) =>
    ped.target || ped.rival || Math.hypot(ped.x - p.x, ped.y - p.y) < 980);
  const want = 44;
  let guard = 0;
  while (G.peds.filter((q) => !q.rival).length < want && guard++ < 30) {
    const a = randRange(G.rng, 0, Math.PI * 2);
    const d = randRange(G.rng, 330, 760);
    const x = clamp(p.x + Math.cos(a) * d, 30, 5170);
    const y = clamp(p.y + Math.sin(a) * d, 30, SEA_Y - 30);
    const res = collideCircle(G.city, x, y, 12);
    if (res.hit) continue;
    if (isOnRoad(res.x, res.y) && chance(G.rng, 0.6)) continue; // most spawn off-road
    const ped = createPed(G.rng, res.x, res.y);
    pickWanderTarget(G, ped);
    G.peds.push(ped);
  }
}

export function drawPedestrian(ctx, ped, time) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  // Shadow.
  ctx.fillStyle = 'rgba(40,30,20,0.25)';
  ctx.beginPath();
  ctx.ellipse(1.5, 3, 10, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (ped.state === 'down') {
    ctx.rotate(ped.angle);
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(15, 0, 5.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const moving = ped.speed > 4;
  const swing = moving ? Math.sin(ped.walkPhase * 6) * 5 : 0;
  ctx.rotate(ped.angle + Math.PI / 2);
  // Legs.
  ctx.strokeStyle = ped.pants;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-3.4, 3);
  ctx.lineTo(-3.4 + swing * 0.4, 9 + Math.abs(swing) * 0.4);
  ctx.moveTo(3.4, 3);
  ctx.lineTo(3.4 - swing * 0.4, 9 + Math.abs(swing) * 0.4);
  ctx.stroke();
  // Torso.
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.ellipse(0, 0, 7.6, 9.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Arms.
  ctx.strokeStyle = ped.shirt;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(-7.4, -2);
  ctx.lineTo(-9.4, 4 - swing * 0.5);
  ctx.moveTo(7.4, -2);
  ctx.lineTo(9.4, 4 + swing * 0.5);
  ctx.stroke();
  // Head and hat.
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(0, -1.5, 5.6, 0, Math.PI * 2);
  ctx.fill();
  if (ped.hat) {
    ctx.fillStyle = ped.hatColor;
    ctx.beginPath();
    ctx.arc(0, -2.2, 6.2, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-7.6, -2.6, 15.2, 2);
  }
  // What they carry.
  if (ped.carries === 'bag') {
    ctx.fillStyle = '#e8e3d8';
    ctx.fillRect(7.6, 3.4, 6.4, 7.6);
  } else if (ped.carries === 'box') {
    ctx.fillStyle = '#b08954';
    ctx.fillRect(-5.4, 6.4, 10.8, 8.2);
  } else if (ped.carries === 'cup') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(8.2, 2.6, 3.8, 5.4);
  }
  ctx.restore();

  // The tail target wears a marker ring so the player can keep eyes on him.
  if (ped.target) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,209,26,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 17 + Math.sin(time * 5) * 2.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
