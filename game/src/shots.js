// shots.js — the four deterministic screenshot scenes (?shot=chase|onfoot|
// combat|progress). Each stages the REAL game state — real cars, police,
// peds, missions and HUD — around the player, so a screenshot is a true
// render of the running game, never a composition.

import { createCar } from './vehicles.js';
import { createPed } from './pedestrians.js';
import { makeTrafficCar } from './traffic.js';
import { laySkid, addTracer, burstSparks } from './effects.js';
import { MISSIONS } from './missions.js';

function baseScene(G, clockMin) {
  G.screen = 'play';
  G.clockMin = clockMin;
  G.time = 42;
  G.banner = null;
  G.mission.cardT = 0;
  G.wanted.level = 0;
  G.policeCars = [];
  G.officers = [];
  G.peds = G.peds.filter((p) => p.rival || p.target);
}

function putPlayerInCar(G, car) {
  car.driver = 'player';
  car.parked = false;
  G.cars.push(car);
  G.player.car = car;
  G.player.x = car.x;
  G.player.y = car.y;
  G.player.angle = car.angle;
}

function addPed(G, x, y, opts) {
  const ped = createPed(G.rng, x, y);
  Object.assign(ped, opts || {});
  G.peds.push(ped);
  return ped;
}

function frameCamera(G, zoom) {
  G.camera.x = G.player.x;
  G.camera.y = G.player.y;
  G.camera.zoom = zoom;
  G.camera.shake = 0;
}

// 1 — THE COVER: a five-star golden-hour chase through Centro Dorado.
export function stageChase(G) {
  baseScene(G, 17 * 60 + 42);
  G.progress.missionsDone = 7;
  G.mission.active = MISSIONS[7];
  G.mission.stageIdx = 2; // escaping the heist to Casa Solmar
  G.cash = 4870;
  G.respect = 236;
  G.player.hp = 82;
  G.arsenal.pistol.ammo = 34;
  G.arsenal.current = 'pistol';
  G.stats.playTime = 1610;

  const car = createCar('sports', 2520, 1180, Math.PI / 2, '#e33e2b');
  car.speed = 305;
  putPlayerInCar(G, car);

  const pursuers = [
    [2462, 1186, 292], [2490, 1050, 300], [2552, 945, 312],
  ];
  for (const [x, y, sp] of pursuers) {
    const cop = createCar('police', x, y, Math.PI / 2, '#f2f4f6');
    cop.driver = 'police';
    cop.parked = false;
    cop.speed = sp;
    G.policeCars.push(cop);
  }
  G.officers.push({ x: 2636, y: 1090, angle: Math.PI, walkPhase: 2, state: 'chase', hp: 60 });

  const ahead1 = makeTrafficCar(G.rng, 2490, 1355);
  ahead1.x = 2490; ahead1.y = 1355; ahead1.angle = Math.PI / 2; ahead1.speed = 120;
  const ahead2 = makeTrafficCar(G.rng, 2552, 1510);
  ahead2.x = 2552; ahead2.y = 1510; ahead2.angle = Math.PI / 2; ahead2.speed = 105;
  G.cars.push(ahead1, ahead2);

  // Skid marks trail the chase down the avenue.
  for (let i = 0; i < 30; i++) {
    laySkid(G.fx, 2506 + Math.sin(i * 0.35) * 6, 1156 - i * 11, Math.PI / 2);
    laySkid(G.fx, 2534 + Math.sin(i * 0.35) * 6, 1156 - i * 11, Math.PI / 2);
  }
  // Pedestrians scatter on both sidewalks.
  G.threat.active = true;
  G.threat.x = 2520;
  G.threat.y = 1180;
  const fleeSpots = [
    [2418, 1060], [2412, 1300], [2630, 1120], [2624, 1380],
    [2408, 920], [2638, 1270], [2426, 1470], [2614, 980],
  ];
  for (const [x, y] of fleeSpots) {
    addPed(G, x, y, { state: 'flee', stateT: 0.4, angle: x < 2520 ? Math.PI : 0 });
  }
  addPed(G, 2402, 1560, { state: 'walk' });
  addPed(G, 2644, 1620, { state: 'walk' });
  G.wanted.level = 5;
  frameCamera(G, 0.86);
}

// 2 — ON FOOT: midday in the market quarter, tailing the courier.
export function stageOnfoot(G) {
  baseScene(G, 12 * 60 + 12);
  G.progress.missionsDone = 2;
  G.mission.active = MISSIONS[2];
  G.mission.stageIdx = 0;
  G.mission.detection = 0.38;
  G.cash = 1320;
  G.respect = 74;
  G.player.hp = 100;
  G.stats.playTime = 640;

  G.player.x = 4200;
  G.player.y = 1012;
  G.player.angle = 0.15;

  const courier = addPed(G, 4470, 950, { target: true, shirt: '#f4f1de', hat: true, hatColor: '#d94f3d' });
  G.mission.courier = courier;
  G.mission.tailWalker = {
    angle: 0,
    waypoints: [{ x: 4540, y: 950 }, { x: 4540, y: 470 }, { x: 4060, y: 470 }],
    idx: 0,
  };
  // A living crowd between the stalls.
  const crowd = [
    [4080, 962], [4145, 1085], [4290, 955], [4330, 1090], [4410, 1115], [4520, 990],
    [4600, 1080], [4660, 960], [4030, 1105], [4380, 1005], [4550, 1140], [4240, 1145],
    [4700, 1060], [4120, 1180], [4480, 880], [4360, 880],
  ];
  crowd.forEach(([x, y], i) => {
    addPed(G, x, y, { state: i % 5 === 4 ? 'stand' : 'walk', angle: (i * 0.9) % 6.3 });
  });
  frameCamera(G, 1.02);
}

// 3 — COMBAT: the harbour shootout, scattergun mid-blast.
export function stageCombat(G) {
  baseScene(G, 15 * 60 + 45);
  G.progress.missionsDone = 6;
  G.mission.active = MISSIONS[6];
  G.mission.stageIdx = 1;
  G.mission.cardT = 6;
  G.mission.rivalsDown = 3;
  G.cash = 3910;
  G.respect = 188;
  G.player.hp = 54;
  G.player.hurtT = 0.2;
  G.arsenal.current = 'scatter';
  G.arsenal.scatter.ammo = 3;
  G.arsenal.pistol.ammo = 12;
  G.stats.playTime = 1290;

  G.player.x = 782;
  G.player.y = 2692;
  G.player.angle = 0.32;
  G.arsenal.flashT = 0.055;
  G.arsenal.flashAngle = 0.32;

  // Pellet tracers fan out from the muzzle; sparks bite the container.
  const mx = G.player.x + Math.cos(0.32) * 26;
  const my = G.player.y + Math.sin(0.32) * 26;
  const hits = [
    [898, 2600], [905, 2642], [892, 2688], [910, 2730], [884, 2772], [918, 2812], [900, 2848],
  ];
  for (const [hx, hy] of hits) addTracer(G.fx, mx, my, hx, hy, '#ffd9a0');
  burstSparks(G.fx, 902, 2642);
  burstSparks(G.fx, 908, 2730);

  const rivalSpots = [
    [880, 2580, 'stand'], [900, 2760, 'stand'], [850, 2830, 'stand'],
    [845, 2620, 'down'], [872, 2745, 'down'], [812, 2805, 'down'],
  ];
  for (const [x, y, st] of rivalSpots) {
    addPed(G, x, y, {
      rival: true, state: st, hp: st === 'down' ? 0 : 42,
      shirt: '#3a3f44', hat: true, hatColor: '#c22f2f', angle: Math.PI + 0.3,
    });
  }
  // Paloma's getaway car waits with its door open.
  const getaway = createCar('sedan', 636, 2904, 0.12, '#57a773');
  getaway.driver = null;
  getaway.parked = true;
  getaway.doorOpen = true;
  getaway.missionCar = true;
  G.cars.push(getaway);
  G.mission.targetCar = getaway;
  frameCamera(G, 1.02);
}

// 4 — PROGRESS: the missions board open over the beachfront at dusk.
export function stageProgress(G) {
  baseScene(G, 18 * 60 + 52);
  G.progress.missionsDone = 5;
  G.progress.coursesWon = [true, true, false];
  G.progress.discsFound = 7;
  G.discs.forEach((d, i) => { d.found = i < 7; });
  G.cash = 5230;
  G.respect = 266;
  G.player.hp = 96;
  G.stats.playTime = 754;
  G.stats.carsStolen = 9;
  G.stats.racesWon = 2;

  G.player.x = 2470;
  G.player.y = 3446;
  G.player.angle = Math.PI / 2;
  const strollers = [
    [2330, 3400], [2620, 3392], [2740, 3470], [2280, 3490], [2560, 3520],
  ];
  for (const [x, y] of strollers) addPed(G, x, y, { state: 'walk', angle: 0.6 });
  const parked = createCar('coupe', 2130, 3245, 0, '#274156');
  parked.parked = true;
  G.cars.push(parked);
  G.screen = 'board';
  frameCamera(G, 1.0);
}

export const SHOT_SCENES = {
  chase: stageChase,
  onfoot: stageOnfoot,
  combat: stageCombat,
  progress: stageProgress,
};
