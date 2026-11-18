// police.js — the wanted system and the Solmar Bay police response:
// stars that rise with crime and decay when the heat is off, foot officers
// who chase and arrest, patrol cars with flashing light bars that chase and
// ram, and roadblocks at four stars and up.

import { randRange, clamp } from './random.js';
import { collideCircle, lineBlocked } from './city.js';
import { createCar, stepCarPhysics, steerTowards } from './vehicles.js';
import { WANTED_DECAY_SECONDS } from './config.js';

export function createWanted() {
  return { level: 0, quiet: 0, sight: false, roadblockT: 0 };
}

// Register a crime: the wanted level rises to at least minStars.
export function commitCrime(G, minStars) {
  const w = G.wanted;
  w.level = clamp(Math.max(w.level, minStars), 0, 5);
  w.quiet = 0;
}

export function policeSeePlayer(G) {
  const p = G.player;
  const sees = (x, y, range) => {
    if (Math.hypot(x - p.x, y - p.y) > range) return false;
    return !lineBlocked(G.city, x, y, p.x, p.y);
  };
  for (const c of G.policeCars) if (sees(c.x, c.y, 470)) return true;
  for (const o of G.officers) if (sees(o.x, o.y, 380)) return true;
  return false;
}

export function updateWanted(G, dt) {
  const w = G.wanted;
  if (w.level <= 0) {
    w.quiet = 0;
    return;
  }
  w.sight = policeSeePlayer(G);
  if (w.sight) w.quiet = 0;
  else w.quiet += dt;
  if (w.quiet > WANTED_DECAY_SECONDS) {
    w.level -= 1;
    w.quiet = 0;
    if (w.level <= 0) clearPolice(G);
  }
  w.roadblockT -= dt;
}

function spawnPoint(G, dist) {
  const p = G.player;
  for (let i = 0; i < 8; i++) {
    const a = randRange(G.rng, 0, Math.PI * 2);
    const x = clamp(p.x + Math.cos(a) * dist, 60, 5140);
    const y = clamp(p.y + Math.sin(a) * dist, 60, 3260);
    const res = collideCircle(G.city, x, y, 26);
    if (!res.hit) return res;
  }
  return { x: p.x + dist, y: p.y };
}

export function maintainPolice(G) {
  const w = G.wanted;
  const p = G.player;
  // Remove units that are far away once the heat is gone.
  G.policeCars = G.policeCars.filter((c) => !c.wrecked &&
    (w.level > 0 || Math.hypot(c.x - p.x, c.y - p.y) < 700));
  G.officers = G.officers.filter((o) => o.state !== 'down' &&
    (w.level > 0 || Math.hypot(o.x - p.x, o.y - p.y) < 600));
  if (w.level <= 0) return;

  const wantCars = w.level >= 2 ? Math.min(w.level - 1, 4) : (p.car ? 1 : 0);
  const wantOfficers = Math.min(1 + w.level, 4);
  if (G.policeCars.length < wantCars) {
    const s = spawnPoint(G, randRange(G.rng, 500, 640));
    const car = createCar('police', s.x, s.y, randRange(G.rng, 0, 6), '#f2f4f6');
    car.driver = 'police';
    car.parked = false;
    G.policeCars.push(car);
  }
  if (G.officers.length < wantOfficers) {
    const s = spawnPoint(G, randRange(G.rng, 380, 520));
    G.officers.push({ x: s.x, y: s.y, angle: 0, walkPhase: 0, state: 'chase', hp: 60 });
  }
  if (w.level >= 4 && p.car && w.roadblockT <= 0) {
    setRoadblock(G);
    w.roadblockT = 26;
  }
}

function setRoadblock(G) {
  // Two patrol cars parked nose-to-nose across the road ahead of the player.
  const p = G.player;
  const car = p.car;
  const ahead = 430;
  const tx = clamp(car.x + Math.cos(car.angle) * ahead, 80, 5120);
  const ty = clamp(car.y + Math.sin(car.angle) * ahead, 80, 3240);
  for (const side of [-1, 1]) {
    const bx = tx + Math.cos(car.angle + Math.PI / 2) * side * 30;
    const by = ty + Math.sin(car.angle + Math.PI / 2) * side * 30;
    const res = collideCircle(G.city, bx, by, 26);
    const blocker = createCar('police', res.x, res.y, car.angle + Math.PI / 2, '#f2f4f6');
    blocker.driver = 'police';
    blocker.parked = true;
    blocker.blocker = true;
    G.policeCars.push(blocker);
  }
}

export function clearPolice(G) {
  G.policeCars = G.policeCars.filter((c) => c.blocker !== true);
  // Remaining units simply drive off; maintainPolice removes them.
}

export function updatePoliceCar(G, car, dt) {
  if (car.blocker) return; // a roadblock car holds its line
  const p = G.player;
  const targetX = p.car ? p.car.x : p.x;
  const targetY = p.car ? p.car.y : p.y;
  // Aim a little behind the player's heading so pursuits settle into a chase.
  const lead = p.car ? clamp(p.car.speed * 0.22, -60, 60) : 0;
  const tx = targetX + (p.car ? Math.cos(p.car.angle) * lead : 0);
  const ty = targetY + (p.car ? Math.sin(p.car.angle) * lead : 0);
  const dist = Math.hypot(tx - car.x, ty - car.y);
  const { throttle, steer } = steerTowards(car, tx, ty, 30);
  const impact = stepCarPhysics(G.city, car, dt, throttle, steer, false);
  if (impact > 130) G.audio.crash();
  if (dist < 44 && p.car && Math.abs(p.car.speed) < 26) {
    // Pinned: an officer steps out and the arrest clock starts.
    car.speed = 0;
  }
}

export function updateOfficer(G, officer, dt) {
  const p = G.player;
  const tx = p.car ? p.car.x : p.x;
  const ty = p.car ? p.car.y : p.y;
  const dx = tx - officer.x;
  const dy = ty - officer.y;
  const dist = Math.hypot(dx, dy);
  const playerSlow = !p.car || Math.abs(p.car.speed) < 30;
  if (dist > 20) {
    const speed = 172;
    officer.angle = Math.atan2(dy, dx);
    const res = collideCircle(G.city,
      officer.x + (dx / dist) * speed * dt,
      officer.y + (dy / dist) * speed * dt, 11);
    officer.x = res.x;
    officer.y = res.y;
    officer.walkPhase += dt * 11;
  }
  if (dist < 30 && playerSlow && G.wanted.level > 0) {
    G.bustProgress += dt;
    if (G.bustProgress > 0.85) G.doBust();
  }
}

export function drawOfficer(ctx, officer, time) {
  ctx.save();
  ctx.translate(officer.x, officer.y);
  ctx.fillStyle = 'rgba(40,30,20,0.25)';
  ctx.beginPath();
  ctx.ellipse(1.5, 3, 10, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (officer.state === 'down') {
    ctx.rotate(officer.angle);
    ctx.fillStyle = '#274156';
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const swing = Math.sin(officer.walkPhase * 6) * 5;
  ctx.rotate(officer.angle + Math.PI / 2);
  ctx.strokeStyle = '#1d2733';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-3.4, 3);
  ctx.lineTo(-3.4 + swing * 0.4, 9.4);
  ctx.moveTo(3.4, 3);
  ctx.lineTo(3.4 - swing * 0.4, 9.4);
  ctx.stroke();
  ctx.fillStyle = '#274156';
  ctx.beginPath();
  ctx.ellipse(0, 0, 7.6, 9.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c14e';
  ctx.fillRect(2.6, -3.4, 3.2, 3.2); // badge
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(0, -1.5, 5.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d3557'; // cap
  ctx.beginPath();
  ctx.arc(0, -2.4, 6.0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-6.4, -2.8, 12.8, 2);
  ctx.restore();
}
