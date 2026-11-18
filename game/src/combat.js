// combat.js — the two weapons (a pistol and a scattergun), hitscan firing
// with tracers, muzzle flash and hit sparks, damage to people and cars,
// rival crew who shoot back, and the glowing health/ammo/cash pickups.

import { randRange, clamp } from './random.js';
import { pointInRect, solidsNear } from './city.js';
import { damageCar } from './vehicles.js';
import { commitCrime } from './police.js';
import { burstSparks, addTracer, pickupSparkle, addPopup } from './effects.js';
import { createPed } from './pedestrians.js';

export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 34, cooldown: 0.27, range: 470, pellets: 1,
            spread: 0.022, speed: 980, startAmmo: 60, pickupAmmo: 24, kick: 1.6 },
  scatter: { name: 'Scattergun', damage: 13, cooldown: 0.88, range: 305, pellets: 7,
             spread: 0.17, speed: 800, startAmmo: 18, pickupAmmo: 8, kick: 4.2 },
};

export function createArsenal() {
  return {
    current: 'pistol',
    pistol: { ammo: WEAPONS.pistol.startAmmo },
    scatter: { ammo: WEAPONS.scatter.startAmmo },
    cooldown: 0,
    flashT: 0,
    flashAngle: 0,
  };
}

export function switchWeapon(G, key) {
  if (key && WEAPONS[key]) G.arsenal.current = key;
  else G.arsenal.current = G.arsenal.current === 'pistol' ? 'scatter' : 'pistol';
}

function rayHit(G, ox, oy, angle, range) {
  // March the ray; return the first thing struck and where.
  const step = 9;
  let px = ox;
  let py = oy;
  for (let d = step; d < range; d += step) {
    px = ox + Math.cos(angle) * d;
    py = oy + Math.sin(angle) * d;
    for (const b of solidsNear(G.city, px, py, 4)) {
      if (pointInRect(px, py, b, 0)) return { x: px, y: py, kind: 'wall' };
    }
    for (const ped of G.peds) {
      if (ped.state !== 'down' && Math.hypot(ped.x - px, ped.y - py) < 12) {
        return { x: px, y: py, kind: 'ped', ped };
      }
    }
    for (const o of G.officers) {
      if (o.state !== 'down' && Math.hypot(o.x - px, o.y - py) < 12) {
        return { x: px, y: py, kind: 'officer', officer: o };
      }
    }
    const cars = G.cars.concat(G.policeCars, G.player.car ? [G.player.car] : []);
    for (const c of cars) {
      if (Math.hypot(c.x - px, c.y - py) < c.w * 0.46) {
        return { x: px, y: py, kind: 'car', car: c };
      }
    }
  }
  return { x: px, y: py, kind: 'none' };
}

export function tryShoot(G, dt) {
  const ars = G.arsenal;
  ars.cooldown -= dt;
  ars.flashT -= dt;
  const p = G.player;
  if (p.car || G.screen !== 'play') return;
  if (!G.input.mouseDown || ars.cooldown > 0) return;
  const def = WEAPONS[ars.current];
  if (ars[ars.current].ammo <= 0) {
    ars.cooldown = 0.3;
    G.audio.blip(220, 0.05, 'square', 0.05);
    return;
  }
  ars[ars.current].ammo -= 1;
  ars.cooldown = def.cooldown;
  ars.flashT = 0.055;

  const aim = Math.atan2(G.mouseWorldY - p.y, G.mouseWorldX - p.x);
  p.angle = aim;
  ars.flashAngle = aim;
  G.audio.shoot(ars.current);
  G.camera.kick = def.kick;
  setThreat(G, p.x, p.y);
  commitCrime(G, 2);
  G.stats.shotsFired += def.pellets;

  const mx = p.x + Math.cos(aim) * 18;
  const my = p.y + Math.sin(aim) * 18;
  for (let i = 0; i < def.pellets; i++) {
    const a = aim + randRange(G.rng, -def.spread, def.spread);
    const hit = rayHit(G, mx, my, a, def.range);
    addTracer(G.fx, mx, my, hit.x, hit.y, ars.current === 'scatter' ? '#ffd9a0' : '#ffe9a8');
    if (hit.kind === 'wall' || hit.kind === 'car') burstSparks(G.fx, hit.x, hit.y);
    if (hit.kind === 'ped') hurtPed(G, hit.ped, def.damage);
    if (hit.kind === 'officer') {
      hit.officer.hp -= def.damage;
      commitCrime(G, 3);
      if (hit.officer.hp <= 0) {
        hit.officer.state = 'down';
        addPopup(G.fx, hit.officer.x, hit.officer.y - 20, 'OFFICER DOWN', '#ff8a75');
      }
    }
    if (hit.kind === 'car') {
      damageCar(hit.car, def.damage * 0.5);
      if (hit.car.driver === 'traffic' && hit.car.hp < hit.car.maxHp) {
        // A shot-up driver bails out and runs.
        bailOutDriver(G, hit.car);
      }
    }
  }
}

export function hurtPed(G, ped, damage) {
  ped.hp -= damage;
  burstSparks(G.fx, ped.x, ped.y);
  if (ped.hp <= 0 && ped.state !== 'down') {
    ped.state = 'down';
    ped.carries = null;
    if (ped.rival) {
      G.mission.rivalsDown = (G.mission.rivalsDown || 0) + 1;
      addPopup(G.fx, ped.x, ped.y - 20, 'SCORPION DOWN', '#ffb3a0');
      maybeDropPickup(G, ped.x, ped.y);
    } else {
      commitCrime(G, 2);
      addPopup(G.fx, ped.x, ped.y - 20, 'CIVILIAN DOWN', '#ff8a75');
    }
  } else if (!ped.rival) {
    ped.state = 'flee';
    ped.stateT = 0;
  }
}

function bailOutDriver(G, car) {
  // The driver climbs out beside the car and runs for it.
  const ped = createPed(G.rng, car.x + 20, car.y + 14);
  ped.state = 'flee';
  ped.stateT = 0;
  G.peds.push(ped);
  setThreat(G, car.x, car.y);
  car.driver = null;
  car.parked = true;
  car.speed = 0;
}

export function setThreat(G, x, y) {
  G.threat.x = x;
  G.threat.y = y;
  G.threat.active = true;
  G.threat.t = 0;
}

// Rival crew fire back during the harbour confrontation.
export function updateRivalShooters(G, dt) {
  const p = G.player;
  for (const ped of G.peds) {
    if (!ped.rival || ped.state === 'down') continue;
    ped.fireT = (ped.fireT || randRange(G.rng, 0.4, 1.4)) - dt;
    const dist = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (ped.fireT > 0 || dist > 400 || G.screen !== 'play') continue;
    ped.fireT = randRange(G.rng, 1.1, 2.1);
    ped.angle = Math.atan2(p.y - ped.y, p.x - ped.x);
    const mx = ped.x + Math.cos(ped.angle) * 16;
    const my = ped.y + Math.sin(ped.angle) * 16;
    const jitter = randRange(G.rng, -26, 26);
    const tx = p.x + Math.cos(ped.angle + Math.PI / 2) * jitter * 0.2;
    const ty = p.y + Math.sin(ped.angle + Math.PI / 2) * jitter * 0.2;
    addTracer(G.fx, mx, my, tx, ty, '#ff9d7a');
    burstSparks(G.fx, mx, my);
    G.audio.shoot('pistol');
    setThreat(G, ped.x, ped.y);
    const hitChance = clamp(0.62 - dist / 700, 0.12, 0.6);
    if (G.rng() < hitChance) hurtPlayer(G, randRange(G.rng, 5, 10));
  }
}

export function hurtPlayer(G, damage) {
  const p = G.player;
  if (G.screen !== 'play') return;
  p.hp -= damage;
  p.hurtT = 0.35;
  G.camera.shake = Math.max(G.camera.shake, 3);
  if (p.hp <= 0) {
    p.hp = 0;
    G.doWasted();
  }
}

// --- pickups --------------------------------------------------------------

const PICKUP_KINDS = ['health', 'ammo-pistol', 'ammo-scatter', 'cash'];

export function maybeDropPickup(G, x, y) {
  if (G.rng() < 0.55) {
    G.pickups.push({ x, y, kind: PICKUP_KINDS[Math.floor(G.rng() * 3)], bob: G.rng() * 6 });
  }
}

export function scatterPickups(G, count) {
  for (let i = 0; i < count; i++) {
    const x = randRange(G.rng, 200, 5000);
    const y = randRange(G.rng, 200, 3200);
    G.pickups.push({ x, y, kind: PICKUP_KINDS[i % PICKUP_KINDS.length], bob: G.rng() * 6 });
  }
}

export function updatePickups(G, dt) {
  const p = G.player;
  for (const pk of G.pickups) pk.bob += dt * 3;
  if (p.car) return;
  G.pickups = G.pickups.filter((pk) => {
    if (Math.hypot(pk.x - p.x, pk.y - p.y) > 26) return true;
    pickupSparkle(G.fx, pk.x, pk.y, pickupColor(pk.kind));
    G.audio.pickup();
    if (pk.kind === 'health') {
      p.hp = clamp(p.hp + 35, 0, 100);
      addPopup(G.fx, p.x, p.y - 24, '+35 HEALTH', '#8ce99a');
    } else if (pk.kind === 'cash') {
      G.addCash(45);
      addPopup(G.fx, p.x, p.y - 24, '+$45', '#ffe066');
    } else {
      const key = pk.kind === 'ammo-pistol' ? 'pistol' : 'scatter';
      G.arsenal[key].ammo += WEAPONS[key].pickupAmmo;
      addPopup(G.fx, p.x, p.y - 24, `+${WEAPONS[key].pickupAmmo} ${WEAPONS[key].name.toUpperCase()}`, '#ffd9a0');
    }
    return false;
  });
}

export function pickupColor(kind) {
  if (kind === 'health') return '#ff6b81';
  if (kind === 'cash') return '#51cf66';
  return '#ffd43b';
}

export function drawPickup(ctx, pk, time) {
  const bobY = Math.sin(pk.bob) * 3;
  ctx.save();
  ctx.translate(pk.x, pk.y + bobY);
  const pulse = 0.75 + Math.sin(time * 5 + pk.bob) * 0.25;
  ctx.globalAlpha = 0.35 * pulse;
  ctx.fillStyle = pickupColor(pk.kind);
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#20242a';
  ctx.beginPath();
  ctx.arc(0, 0, 10.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pickupColor(pk.kind);
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = pk.kind === 'health' ? '+' : pk.kind === 'cash' ? '$' : 'A';
  ctx.fillText(label, 0, 0.5);
  ctx.restore();
}
