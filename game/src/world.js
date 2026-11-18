// world.js — the living state of one Solmar Bay session: the player on foot
// and in cars, stealing, collisions, the camera, the clock, busted/wasted,
// saving and loading, and the per-frame orchestration of every other system.

import { WORLD_W, WORLD_H, SEA_Y, SAND_Y, PLAYER_WALK_SPEED, PLAYER_RUN_SPEED,
  PLAYER_MAX_HP, BUST_FINE_RATE, SAVE_KEY, CLOCK_START_MIN, CLOCK_RATE } from './config.js';
import { makeRng, clamp, lerp, distanceBetween } from './random.js';
import { buildCity, collideCircle } from './city.js';
import { createEffects, updateEffects, puffSmoke, dustPuff, laySkid, addPopup } from './effects.js';
import { createCar, stepCarPhysics, separateCars, damageCar, CAR_CLASSES } from './vehicles.js';
import { maintainCrowd, updatePedestrians, createPed } from './pedestrians.js';
import { scatterParkedCars, maintainTraffic, updateTrafficCar } from './traffic.js';
import { createWanted, updateWanted, maintainPolice, updatePoliceCar, updateOfficer, commitCrime } from './police.js';
import { createArsenal, switchWeapon, tryShoot, updateRivalShooters, updatePickups, scatterPickups, setThreat } from './combat.js';
import { createMissionState, updateMissions, onRaceFinished } from './missions.js';
import { makeDiscs, updateDiscs, updateRace, raceStartPoint, startRace, RACE_COURSES } from './activities.js';

export function createGame(seed, input, audio) {
  const rng = makeRng(seed);
  const city = buildCity(makeRng(20261));
  const G = {
    seed, rng, city, input, audio,
    time: 0,
    clockMin: CLOCK_START_MIN,
    screen: 'title',
    fx: createEffects(),
    cars: [],
    policeCars: [],
    officers: [],
    peds: [],
    pickups: [],
    dropped: [],
    discs: [],
    wanted: createWanted(),
    arsenal: createArsenal(),
    mission: createMissionState(),
    race: null,
    threat: { x: 0, y: 0, active: false, t: 0 },
    camera: { x: 1975, y: 2560, zoom: 1, shake: 0, kick: 0 },
    player: {
      x: 1975, y: 2620, angle: -Math.PI / 2, walkPhase: 0,
      hp: PLAYER_MAX_HP, car: null, hurtT: 0, lastHurtT: -99, speed: 0,
    },
    cash: 120,
    respect: 0,
    progress: { missionsDone: 0, discsFound: 0, storyDone: false, coursesWon: [false, false, false] },
    stats: { playTime: 0, carsStolen: 0, racesWon: 0, shotsFired: 0, busts: 0 },
    banner: null,
    bustProgress: 0,
    lastFine: 0,
    lastLoss: 0,
    overlayT: 0,
    spawnT: 0,
    musicT: 0,
    mouseWorldX: 0,
    mouseWorldY: 0,
    hint: '',
  };
  G.discs = makeDiscs(G);
  scatterParkedCars(G, 46);
  scatterPickups(G, 10);
  G.addCash = (n) => { G.cash += n; };
  G.addRespect = (n) => { G.respect += n; };
  G.doBust = () => doBust(G);
  G.doWasted = () => doWasted(G);
  G.onRaceFinished = (pos) => onRaceFinished(G, pos);
  G.saveGame = () => saveGame(G);
  loadGame(G);
  maintainCrowd(G);
  maintainTraffic(G);
  return G;
}

export function respectLevel(G) {
  return 1 + Math.floor(G.respect / 50);
}

// --- save / load ------------------------------------------------------------

export function saveGame(G) {
  try {
    const data = {
      cash: G.cash, respect: G.respect,
      missionsDone: G.progress.missionsDone, storyDone: G.progress.storyDone,
      coursesWon: G.progress.coursesWon,
      discs: G.discs.map((d) => d.found),
      stats: G.stats,
      arsenal: { pistol: G.arsenal.pistol.ammo, scatter: G.arsenal.scatter.ammo },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (err) { /* storage may be unavailable; the game plays on */ }
}

export function loadGame(G) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    G.cash = data.cash ?? G.cash;
    G.respect = data.respect ?? 0;
    G.progress.missionsDone = data.missionsDone ?? 0;
    G.progress.storyDone = !!data.storyDone;
    if (Array.isArray(data.coursesWon)) G.progress.coursesWon = data.coursesWon.slice(0, 3);
    if (Array.isArray(data.discs)) {
      data.discs.forEach((found, i) => { if (G.discs[i]) G.discs[i].found = !!found; });
      G.progress.discsFound = G.discs.filter((d) => d.found).length;
    }
    if (data.stats) G.stats = { ...G.stats, ...data.stats };
    if (data.arsenal) {
      G.arsenal.pistol.ammo = data.arsenal.pistol ?? G.arsenal.pistol.ammo;
      G.arsenal.scatter.ammo = data.arsenal.scatter ?? G.arsenal.scatter.ammo;
    }
  } catch (err) { /* a corrupt save is ignored */ }
}

// --- busted / wasted ----------------------------------------------------------

function leaveCarWhereItStands(G) {
  const p = G.player;
  if (p.car) {
    p.car.driver = null;
    p.car.parked = true;
    p.car.speed = 0;
    p.car = null;
  }
}

export function doBust(G) {
  if (G.screen !== 'play') return;
  const fine = Math.min(G.cash, Math.floor(G.cash * BUST_FINE_RATE) + 25);
  G.cash -= fine;
  G.lastFine = fine;
  G.stats.busts += 1;
  leaveCarWhereItStands(G);
  G.wanted.level = 0;
  G.policeCars = [];
  G.officers = [];
  G.bustProgress = 0;
  G.player.x = 2565;
  G.player.y = 668;
  G.player.hp = Math.max(G.player.hp, 55);
  G.screen = 'busted';
  G.overlayT = 3.0;
  G.audio.bustedSound();
  if (G.mission.active) G.mission.cardT = 0;
  saveGame(G);
}

export function doWasted(G) {
  if (G.screen !== 'play') return;
  const loss = Math.min(G.cash, Math.floor(G.cash * 0.08) + 15);
  G.cash -= loss;
  G.lastLoss = loss;
  leaveCarWhereItStands(G);
  G.wanted.level = 0;
  G.policeCars = [];
  G.officers = [];
  G.player.x = 1090;
  G.player.y = 700;
  G.player.hp = PLAYER_MAX_HP;
  G.screen = 'wasted';
  G.overlayT = 3.0;
  G.audio.bustedSound();
  saveGame(G);
}

// --- player -------------------------------------------------------------------

function nearestEnterableCar(G) {
  const p = G.player;
  let best = null;
  let bestD = 56;
  for (const car of G.cars) {
    if (car.wrecked) continue;
    const d = distanceBetween(p.x, p.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function tryEnterExitCar(G) {
  const p = G.player;
  if (p.car) {
    const car = p.car;
    const side = car.angle + Math.PI / 2;
    const res = collideCircle(G.city, car.x + Math.cos(side) * 34, car.y + Math.sin(side) * 34, 12);
    p.x = res.x;
    p.y = res.y;
    car.driver = null;
    car.parked = true;
    car.speed = 0;
    p.car = null;
    return;
  }
  const car = nearestEnterableCar(G);
  if (!car) return;
  if (car.driver === 'traffic') {
    // Yank the driver out; they run, and the law notices.
    const ped = createPed(G.rng, car.x - 22, car.y + 16);
    ped.state = 'flee';
    ped.stateT = 0;
    G.peds.push(ped);
    setThreat(G, car.x, car.y);
  }
  if (!car.wasStolen) {
    car.wasStolen = true;
    G.stats.carsStolen += 1;
    commitCrime(G, 1);
    addPopup(G.fx, car.x, car.y - 30, 'STOLEN', '#ffd43b');
  }
  car.driver = 'player';
  car.parked = false;
  car.doorOpen = false;
  p.car = car;
  G.audio.blip(196, 0.1, 'square', 0.05);
}

function updatePlayerOnFoot(G, dt) {
  const p = G.player;
  const axis = G.input.moveAxis();
  const running = G.input.isDown('ShiftLeft') || G.input.isDown('ShiftRight');
  const speed = running ? PLAYER_RUN_SPEED : PLAYER_WALK_SPEED;
  if (axis.x !== 0 || axis.y !== 0) {
    const len = Math.hypot(axis.x, axis.y);
    const mx = (axis.x / len) * speed * dt;
    const my = (axis.y / len) * speed * dt;
    const res = collideCircle(G.city, p.x + mx, p.y + my, 12);
    p.x = res.x;
    p.y = res.y;
    if (!G.input.mouseDown) p.angle = Math.atan2(axis.y, axis.x);
    p.walkPhase += dt * (running ? 11 : 8);
    p.speed = speed;
    if (p.y > SAND_Y && running) dustPuff(G.fx, p.x, p.y + 6);
  } else {
    p.speed = 0;
  }
  // The safehouse porch heals; elsewhere health creeps back out of combat.
  const nearHome = distanceBetween(p.x, p.y, G.city.safehouse.x, G.city.safehouse.y) < 78;
  if (nearHome) p.hp = clamp(p.hp + 16 * dt, 0, PLAYER_MAX_HP);
  else if (G.time - p.lastHurtT > 6) p.hp = clamp(p.hp + 2.4 * dt, 0, PLAYER_MAX_HP);
}

function updatePlayerDriving(G, dt) {
  const p = G.player;
  const car = p.car;
  const axis = G.input.moveAxis();
  const throttle = axis.y < 0 ? 1 : axis.y > 0 ? -1 : 0;
  const steer = (axis.x < 0 ? -1 : 0) + (axis.x > 0 ? 1 : 0);
  const handbrake = G.input.isDown('Space');
  const impact = stepCarPhysics(G.city, car, dt, throttle, steer, handbrake);
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = Math.abs(car.speed);

  const fast = Math.abs(car.speed) > 190;
  if (fast && (handbrake || Math.abs(steer) > 0 && Math.abs(car.speed) > 240)) {
    const backX = car.x - Math.cos(car.angle) * car.w * 0.32;
    const backY = car.y - Math.sin(car.angle) * car.w * 0.32;
    laySkid(G.fx, backX, backY, car.angle);
    if (G.rng() < 0.4) G.audio.noiseBurst(0.05, 0.03, 3000);
  }
  if (car.y > SAND_Y && Math.abs(car.speed) > 60 && G.rng() < 0.5) {
    dustPuff(G.fx, car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20);
  }
  if (impact > 120) {
    damageCar(car, impact * 0.06);
    G.camera.shake = Math.max(G.camera.shake, Math.min(9, impact * 0.03));
    setThreat(G, car.x, car.y);
    G.audio.crash();
    if (impact > 210) commitCrime(G, 1);
  }
  if (car.hp < car.maxHp * 0.45 && G.rng() < dt * 6) {
    puffSmoke(G.fx, car.x + Math.cos(car.angle) * 18, car.y + Math.sin(car.angle) * 18, car.hp < car.maxHp * 0.2);
  }
  // Running someone down is the bay's worst look.
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    if (Math.abs(car.speed) > 46 && distanceBetween(car.x, car.y, ped.x, ped.y) < car.w * 0.5 + 8) {
      ped.state = 'down';
      ped.hp = 0;
      if (ped.rival) G.mission.rivalsDown += 1;
      else commitCrime(G, 2);
      setThreat(G, car.x, car.y);
      damageCar(car, 4);
      G.audio.crash();
      addPopup(G.fx, ped.x, ped.y - 22, ped.rival ? 'SCORPION DOWN' : 'PEDESTRIAN HIT', '#ff8a75');
    }
  }
}

// --- the frame ------------------------------------------------------------------

export function updateGame(G, dt) {
  G.time += dt;
  G.stats.playTime += dt;
  G.clockMin += CLOCK_RATE * dt;
  if (G.clockMin >= 24 * 60) G.clockMin = 6 * 60;
  if (G.banner) {
    G.banner.t += dt;
    if (G.banner.t > G.banner.ttl) G.banner = null;
  }
  if (G.threat.active) {
    G.threat.t += dt;
    if (G.threat.t > 3.5) G.threat.active = false;
  }
  const p = G.player;
  p.hurtT -= dt;
  if (p.hp < PLAYER_MAX_HP && p.hurtT > 0) p.lastHurtT = G.time;

  // Keys that act on the world itself.
  if (G.input.wasPressed('KeyE') || G.input.wasPressed('KeyF')) tryEnterExitCar(G);
  if (G.input.wasPressed('KeyQ')) switchWeapon(G);
  if (G.input.wasPressed('Digit1')) switchWeapon(G, 'pistol');
  if (G.input.wasPressed('Digit2')) switchWeapon(G, 'scatter');
  if (G.input.wasPressed('KeyR') && !G.race && p.car) tryStartNearbyRace(G);

  if (p.car) updatePlayerDriving(G, dt);
  else updatePlayerOnFoot(G, dt);

  for (const car of G.cars) {
    if (car.driver === 'traffic') updateTrafficCar(G, car, dt);
  }
  // Car-to-car contact for everyone on the road.
  const allCars = G.cars.concat(G.policeCars);
  for (let i = 0; i < allCars.length; i++) {
    for (let j = i + 1; j < allCars.length; j++) {
      if (separateCars(allCars[i], allCars[j])) setThreat(G, allCars[i].x, allCars[i].y);
    }
  }

  updatePedestrians(G, dt);
  tryShoot(G, dt);
  updateRivalShooters(G, dt);
  updatePickups(G, dt);
  updateDiscs(G);
  updateMissions(G, dt);
  updateRace(G, dt);
  updateWanted(G, dt);
  maintainPolice(G);
  for (const car of G.policeCars) updatePoliceCar(G, car, dt);
  G.bustProgress = Math.max(0, G.bustProgress - dt * 0.7);
  for (const officer of G.officers) updateOfficer(G, officer, dt);

  G.spawnT -= dt;
  if (G.spawnT <= 0) {
    G.spawnT = 0.5;
    maintainCrowd(G);
    maintainTraffic(G);
  }
  for (const d of G.dropped) d.life += dt;
  G.dropped = G.dropped.filter((d) => d.life < 20);

  updateEffects(G.fx, dt);
  updateCamera(G, dt);

  // Sound: engine note follows the car, sirens follow the heat.
  const ratio = p.car ? clamp(Math.abs(p.car.speed) / (CAR_CLASSES[p.car.kind].topSpeed), 0, 1) : 0;
  G.audio.setEngine(ratio, !!p.car);
  G.audio.setSiren(G.wanted.level > 0 && G.policeCars.length + G.officers.length > 0);
  G.audio.update(dt, G.time);
  G.musicT += dt;
  if (G.audio.playBar && G.musicT > 2.4) {
    G.musicT = 0;
    G.audio.playBar();
  }
}

function tryStartNearbyRace(G) {
  for (let i = 0; i < RACE_COURSES.length; i++) {
    const s = raceStartPoint(i);
    if (distanceBetween(G.player.x, G.player.y, s.x, s.y) < 120) {
      startRace(G, i, false);
      return;
    }
  }
}

export function updateCamera(G, dt) {
  const p = G.player;
  const cam = G.camera;
  const lead = p.car ? clamp(p.car.speed * 0.34, -120, 120) : 0;
  const tx = p.x + (p.car ? Math.cos(p.car.angle) * lead : 0);
  const ty = p.y + (p.car ? Math.sin(p.car.angle) * lead : 0);
  const k = 1 - Math.pow(0.0015, dt);
  cam.x = lerp(cam.x, tx, k);
  cam.y = lerp(cam.y, ty, k);
  const targetZoom = p.car ? 0.9 : 1.02;
  cam.zoom = lerp(cam.zoom, targetZoom, 1 - Math.pow(0.01, dt));
  cam.shake = Math.max(0, cam.shake - dt * 14);
  cam.kick = Math.max(0, cam.kick - dt * 26);
  const vw = 1280 / cam.zoom;
  const vh = 720 / cam.zoom;
  cam.x = clamp(cam.x, vw / 2 - 60, WORLD_W - vw / 2 + 60);
  cam.y = clamp(cam.y, vh / 2 - 60, WORLD_H - vh / 2 + 60);
}

// Where the mouse points in the world, for aiming.
export function computeMouseWorld(G) {
  const cam = G.camera;
  const shakeX = cam.shake ? (Math.random() - 0.5) * cam.shake : 0;
  const shakeY = cam.shake ? (Math.random() - 0.5) * cam.shake : 0;
  G.mouseWorldX = cam.x + (G.input.mouseX - 640) / cam.zoom + shakeX;
  G.mouseWorldY = cam.y + (G.input.mouseY - 360) / cam.zoom + shakeY;
}
