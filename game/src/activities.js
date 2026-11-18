// activities.js — the repeatable life of Solmar Bay beyond the story:
// three checkpoint street races against two AI drivers (position and time
// on the HUD, cash for a win) and twelve hidden sun discs to collect.

import { randRange, clamp, distanceBetween } from './random.js';
import { createCar, steerTowards, stepCarPhysics, CAR_CLASSES } from './vehicles.js';
import { collideCircle } from './city.js';
import { pickupSparkle, addPopup } from './effects.js';

export const RACE_COURSES = [
  {
    name: 'Promenade Grand Prix', short: 'Promenade',
    points: [
      [700, 2980], [1820, 2980], [3220, 2980], [4620, 2980],
      [4620, 2330], [3220, 2330], [1820, 2330], [760, 2330],
    ],
  },
  {
    name: 'Centro Circuit', short: 'Centro',
    points: [
      [420, 380], [1820, 380], [3220, 380], [4620, 380],
      [4620, 1030], [4620, 1680], [2520, 1680], [420, 1680], [420, 1030],
    ],
  },
  {
    name: 'Harbour Run', short: 'Harbour',
    points: [
      [420, 2330], [420, 2980], [1820, 2980], [2520, 2980],
      [2520, 1680], [1120, 1680], [1120, 2330],
    ],
  },
];

export function raceStartPoint(courseIdx) {
  const p = RACE_COURSES[courseIdx].points[0];
  return { x: p[0], y: p[1] };
}

export function startRace(G, courseIdx, forMission) {
  const course = RACE_COURSES[courseIdx];
  const [sx, sy] = course.points[0];
  const ai = [];
  const kinds = ['coupe', 'sports'];
  for (let i = 0; i < 2; i++) {
    const kind = kinds[i];
    const car = createCar(kind, sx - 60 - i * 8, sy + (i === 0 ? -34 : 34),
      0, CAR_CLASSES[kind].colors[i % CAR_CLASSES[kind].colors.length]);
    car.driver = 'race';
    car.parked = false;
    G.cars.push(car);
    ai.push({ car, cp: 0, finished: false, finishT: 0, skill: 0.86 + i * 0.07 });
  }
  G.race = {
    course: courseIdx,
    name: course.name,
    points: course.points,
    forMission: !!forMission,
    state: 'countdown',
    t: 3.2,
    runT: 0,
    playerCp: 0,
    playerFinished: false,
    playerFinishT: 0,
    ai,
    lastBeep: 4,
  };
  G.banner = { title: course.name.toUpperCase(), sub: forMission ? 'Win it — Paloma is watching' : 'First to the last checkpoint wins $300', t: 0, ttl: 2.6, bad: false };
}

export function playerRacePosition(G) {
  const race = G.race;
  if (!race) return 1;
  const rankOf = (cp, x, y) => {
    const [tx, ty] = race.points[Math.min(cp, race.points.length - 1)];
    return cp * 100000 - distanceBetween(x, y, tx, ty);
  };
  const mine = rankOf(race.playerCp, G.player.x, G.player.y);
  let pos = 1;
  for (const a of race.ai) {
    if (rankOf(a.cp, a.car.x, a.car.y) > mine) pos++;
  }
  return pos;
}

export function updateRace(G, dt) {
  const race = G.race;
  if (!race) return;
  if (race.state === 'countdown') {
    race.t -= dt;
    const whole = Math.ceil(race.t);
    if (whole !== race.lastBeep && whole >= 1) {
      race.lastBeep = whole;
      G.audio.beep(false);
    }
    if (race.t <= 0) {
      race.state = 'run';
      G.audio.beep(true);
    }
    return;
  }
  race.runT += dt;

  // Player progress.
  if (!race.playerFinished && G.player.car) {
    const [tx, ty] = race.points[race.playerCp];
    if (distanceBetween(G.player.x, G.player.y, tx, ty) < 95) {
      race.playerCp += 1;
      G.audio.pickup();
      if (race.playerCp >= race.points.length) {
        race.playerFinished = true;
        race.playerFinishT = race.runT;
      }
    }
  }

  // AI drivers chase their next checkpoint, capped by their skill.
  for (const a of race.ai) {
    if (a.finished) continue;
    const [tx, ty] = race.points[a.cp];
    const { throttle, steer } = steerTowards(a.car, tx, ty, 40);
    const cls = CAR_CLASSES[a.car.kind];
    const cap = cls.topSpeed * a.skill;
    const useThrottle = a.car.speed > cap ? 0 : throttle;
    stepCarPhysics(G.city, a.car, dt, useThrottle, steer, false);
    if (distanceBetween(a.car.x, a.car.y, tx, ty) < 95) {
      a.cp += 1;
      if (a.cp >= race.points.length) {
        a.finished = true;
        a.finishT = race.runT;
      }
    }
  }

  const allDone = race.playerFinished && race.ai.every((a) => a.finished);
  if (allDone || race.runT > 420) finishRace(G);
}

function finishRace(G) {
  const race = G.race;
  const results = [
    { who: 'You', t: race.playerFinished ? race.playerFinishT : 9999 },
    ...race.ai.map((a, i) => ({ who: `Driver ${i + 1}`, t: a.finished ? a.finishT : 9999 })),
  ].sort((a, b) => a.t - b.t);
  const position = results.findIndex((r) => r.who === 'You') + 1;
  for (const a of race.ai) {
    G.cars = G.cars.filter((c) => c !== a.car);
  }
  const wasMission = race.forMission;
  G.race = null;
  if (position === 1) {
    G.stats.racesWon += 1;
    if (G.progress.coursesWon) G.progress.coursesWon[race.course] = true;
    if (!wasMission) {
      G.addCash(300);
      G.addRespect(6);
    }
    G.banner = { title: 'RACE WON — 1ST', sub: wasMission ? 'Promenade champion!' : '+$300 · +6 respect', t: 0, ttl: 3.6, bad: false };
    G.audio.jingle();
  } else {
    G.banner = { title: `FINISHED ${position} OF 3`, sub: 'The bay keeps its $300 this time', t: 0, ttl: 3.2, bad: true };
  }
  if (wasMission) G.onRaceFinished(position);
  G.saveGame();
}

// --- sun discs --------------------------------------------------------------

const DISC_SPOTS = [
  // Beaches and promenade first — they are guaranteed open ground.
  { x: 240, y: 3440 }, { x: 1180, y: 3490 }, { x: 2620, y: 3410 }, { x: 3980, y: 3470 },
  { x: 4960, y: 3430 }, { x: 3240, y: 3352 },
];

export function makeDiscs(G) {
  const discs = DISC_SPOTS.map((s) => ({ x: s.x, y: s.y, found: false }));
  // The rest hide in alleys and open lots: sample until clear of buildings.
  let guard = 0;
  while (discs.length < 12 && guard++ < 400) {
    const x = randRange(G.rng, 140, 5060);
    const y = randRange(G.rng, 140, 3180);
    const res = collideCircle(G.city, x, y, 20);
    if (res.hit) continue;
    if (discs.some((d) => distanceBetween(d.x, d.y, x, y) < 420)) continue;
    discs.push({ x, y, found: false });
  }
  return discs;
}

export function updateDiscs(G) {
  const p = G.player;
  for (const d of G.discs) {
    if (d.found) continue;
    if (distanceBetween(p.x, p.y, d.x, d.y) < 34) {
      d.found = true;
      G.progress.discsFound += 1;
      G.addRespect(2);
      pickupSparkle(G.fx, d.x, d.y, '#ffd43b');
      addPopup(G.fx, d.x, d.y - 26, `SUN DISC ${G.progress.discsFound}/12`, '#ffd43b');
      G.audio.cashSound();
      G.saveGame();
    }
  }
}

export function drawDisc(ctx, d, time) {
  if (d.found) return;
  const bob = Math.sin(time * 2.6 + d.x) * 3;
  ctx.save();
  ctx.translate(d.x, d.y + bob);
  ctx.globalAlpha = 0.3 + Math.sin(time * 4 + d.x) * 0.1;
  ctx.fillStyle = '#ffd43b';
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffd43b';
  ctx.strokeStyle = '#e8a13a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff3bf';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  // Little rays.
  ctx.strokeStyle = '#ffd43b';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + time * 0.8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 13, Math.sin(a) * 13);
    ctx.lineTo(Math.cos(a) * 17, Math.sin(a) * 17);
    ctx.stroke();
  }
  ctx.restore();
}

export function formatRaceTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

export { clamp };
