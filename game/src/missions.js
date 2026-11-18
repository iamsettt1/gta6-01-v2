// missions.js — the eight-mission story chain of Solmar Bay, for Tía Carmen
// of Café Brisa, the fixer El Faro, the driver Paloma and the rival crew Los
// Escorpiones del Norte. Each mission is a list of stages (go, drive, steal,
// tail, timed run, race, shootout, robbery, escape) with a briefing card, a
// HUD objective, a world beacon and a cash + respect reward.

import { clamp, distanceBetween } from './random.js';
import { createCar } from './vehicles.js';
import { createPed } from './pedestrians.js';
import { commitCrime } from './police.js';
import { startRace } from './activities.js';
import { addPopup } from './effects.js';

export const MISSIONS = [
  {
    id: 'coffee', name: 'First Coffee Run', giver: 'Tía Carmen',
    start: { x: 600, y: 2610 },
    brief: 'You are new in Solmar Bay, so we start small. Take the crates from my café to the market stall before the ice melts. Drive like you mean it.',
    reward: { cash: 250, respect: 10 },
    stages: [
      { type: 'goto', x: 600, y: 2610, r: 62, label: 'Pick up the crates at Café Brisa' },
      { type: 'drive', x: 4300, y: 700, r: 74, label: 'Deliver the crates to Mercado Viejo' },
    ],
  },
  {
    id: 'borrowed', name: 'Borrowed Wheels', giver: 'Tía Carmen',
    start: { x: 600, y: 2610 },
    brief: 'A coupe at the harbour is, let us say, borrowed. Bring it to El Faro at his taller in Barrio Norte. The police may disagree with the paperwork.',
    reward: { cash: 400, respect: 12 },
    stages: [
      { type: 'steal', x: 700, y: 2900, carKind: 'coupe', label: 'Steal the coupe at Puerto Alba' },
      { type: 'drive', x: 4100, y: 2010, r: 84, label: 'Deliver it to Taller El Faro', needMarkedCar: true },
    ],
  },
  {
    id: 'courier', name: 'The Quiet Courier', giver: 'El Faro',
    start: { x: 3980, y: 1000 },
    brief: 'A courier walks the market at noon carrying something the lighthouse should know about. Follow him on foot. Close enough to see, far enough to stay a shadow.',
    reward: { cash: 450, respect: 14 },
    stages: [
      { type: 'tail', label: "Follow the courier — don't be spotted" },
    ],
  },
  {
    id: 'quarter', name: 'Fifteen Minutes to Norte', giver: 'El Faro',
    start: { x: 2600, y: 2620 },
    brief: 'A package at the marina, a buyer in Barrio Norte, and a clock that does not care about your feelings. Fifteen minutes, city time. Go.',
    reward: { cash: 550, respect: 14 },
    stages: [
      { type: 'goto', x: 2600, y: 2620, r: 62, label: 'Collect the package at Marina Azul' },
      { type: 'drive', x: 4400, y: 2120, r: 84, time: 150, label: 'Reach the Norte depot before the clock dies' },
    ],
  },
  {
    id: 'azul', name: 'The Azul Coupe', giver: 'Paloma',
    start: { x: 1250, y: 3210 },
    brief: 'See that blue sports coupe by the beach? A collector in the marina wants it, gently used and barely scratched. Steal it, keep it pretty, park it in my lockup.',
    reward: { cash: 700, respect: 16 },
    stages: [
      { type: 'steal', x: 1200, y: 3180, carKind: 'sports', carColor: '#2f6fd0', label: 'Steal the Azul Coupe at Playa Serena' },
      { type: 'drive', x: 2400, y: 2900, r: 84, label: "Deliver it to Paloma's lockup, intact", needMarkedCar: true, minHp: 18 },
    ],
  },
  {
    id: 'grandprix', name: 'Promenade Grand Prix', giver: 'Paloma',
    start: { x: 700, y: 2980 },
    brief: 'Words are cheap, newcomer. Beat my two best drivers around the promenade circuit and the whole bay will know your name. Win, or walk home.',
    reward: { cash: 800, respect: 18 },
    stages: [
      { type: 'race', course: 0, label: 'Win the Promenade Grand Prix' },
    ],
  },
  {
    id: 'scorpions', name: 'Harbour of Scorpions', giver: 'El Faro',
    start: { x: 820, y: 2660 },
    brief: 'Los Escorpiones del Norte think Puerto Alba is theirs now. Six of them among the containers. Correct their geography, then take the car Paloma leaves you.',
    reward: { cash: 1000, respect: 22 },
    stages: [
      { type: 'goto', x: 820, y: 2660, r: 70, label: 'Reach the container yard at Puerto Alba' },
      { type: 'fight', count: 6, x: 820, y: 2660, label: 'Clear Los Escorpiones from the yard' },
      { type: 'drive', x: 1975, y: 2590, r: 84, label: 'Take the getaway car back to Casa Solmar', needMarkedCar: true },
    ],
  },
  {
    id: 'heist', name: 'The Marina Heist', giver: 'El Faro',
    start: { x: 3050, y: 2920 },
    brief: 'Last job, and the lighthouse goes dark after this. Empty the marina cash office, then lose four stars worth of police and reach Casa Solmar. Become a legend or a headline.',
    reward: { cash: 2000, respect: 30 },
    stages: [
      { type: 'goto', x: 3050, y: 2920, r: 62, label: 'Enter the Marina Cash Office' },
      { type: 'rob', x: 3050, y: 2920, r: 62, time: 4, label: 'Empty the cash office…' },
      { type: 'escape', x: 1975, y: 2590, r: 90, label: 'Escape to Casa Solmar' },
    ],
  },
];

export function createMissionState() {
  return {
    active: null,       // the mission definition being played
    stageIdx: 0,
    cardT: 0,           // briefing card time left
    stageT: 0,          // per-stage timer (timed drive, robbery)
    detection: 0,       // tail-mission detection meter 0..1
    loseT: 0,           // tail-mission out-of-sight timer
    rivalsDown: 0,
    targetCar: null,
    courier: null,
    tailWalker: null,
    failed: '',
  };
}

export function nextMissionDef(G) {
  return MISSIONS[G.progress.missionsDone] || null;
}

export function currentStage(G) {
  const m = G.mission;
  if (!m.active) return null;
  return m.active.stages[m.stageIdx] || null;
}

// The HUD objective and the beacon position for whatever the player owes.
export function currentObjective(G) {
  const m = G.mission;
  const stage = currentStage(G);
  if (m.active && stage) {
    const point = stagePoint(G, stage);
    return { text: stage.label, x: point.x, y: point.y, mission: m.active };
  }
  const next = nextMissionDef(G);
  if (next) {
    return { text: `See ${next.giver} — “${next.name}”`, x: next.start.x, y: next.start.y, mission: null };
  }
  return { text: 'Solmar Bay is yours — races, sun discs and trouble await', x: G.city.safehouse.x, y: G.city.safehouse.y, mission: null };
}

export function stagePoint(G, stage) {
  if (stage.type === 'tail' && G.mission.courier) {
    return { x: G.mission.courier.x, y: G.mission.courier.y };
  }
  if (stage.type === 'steal' && G.mission.targetCar) {
    return { x: G.mission.targetCar.x, y: G.mission.targetCar.y };
  }
  return { x: stage.x || 0, y: stage.y || 0 };
}

export function tryStartMission(G) {
  const m = G.mission;
  if (m.active) return;
  const next = nextMissionDef(G);
  if (!next) return;
  const d = distanceBetween(G.player.x, G.player.y, next.start.x, next.start.y);
  if (d > 58) return;
  m.active = next;
  m.stageIdx = 0;
  m.cardT = 6.5;
  m.failed = '';
  G.audio.blip(660, 0.14, 'triangle', 0.09);
  setupStage(G);
}

function setupStage(G) {
  const m = G.mission;
  const stage = currentStage(G);
  if (!stage) return;
  m.stageT = stage.time || 0;
  m.detection = 0;
  m.loseT = 0;
  if (stage.type === 'steal') {
    const car = createCar(stage.carKind, stage.x, stage.y, Math.PI / 2, stage.carColor);
    car.driver = null;
    car.parked = true;
    car.missionCar = true;
    G.cars.push(car);
    m.targetCar = car;
  }
  if (stage.type === 'tail') {
    const courier = createPed(G.rng, 4060, 950);
    courier.target = true;
    courier.name = 'The Courier';
    courier.shirt = '#f4f1de';
    courier.hat = true;
    courier.hatColor = '#d94f3d';
    G.peds.push(courier);
    m.courier = courier;
    m.tailWalker = {
      angle: 0,
      waypoints: [
        { x: 4540, y: 950 }, { x: 4540, y: 470 }, { x: 4060, y: 470 },
      ],
      idx: 0,
    };
  }
  if (stage.type === 'fight') {
    m.rivalsDown = 0;
    const spots = [
      [880, 2580], [900, 2760], [680, 2620], [850, 2790], [640, 2740], [760, 2560],
    ];
    for (const [x, y] of spots) {
      const rival = createPed(G.rng, x, y);
      rival.rival = true;
      rival.hp = 42;
      rival.shirt = '#3a3f44';
      rival.hat = true;
      rival.hatColor = '#c22f2f';
      rival.state = 'stand';
      rival.fireT = 1 + G.rng() * 1.5;
      G.peds.push(rival);
    }
    commitCrime(G, 1);
  }
  if (stage.type === 'race') {
    startRace(G, stage.course, true);
  }
  if (stage.type === 'drive' && stage.needMarkedCar && m.active.id === 'scorpions' && !m.targetCar) {
    // Paloma's getaway car waits by the yard gate with its door open.
    const car = createCar('sedan', 1085, 2925, 0, '#57a773');
    car.driver = null;
    car.parked = true;
    car.missionCar = true;
    car.doorOpen = true;
    G.cars.push(car);
    m.targetCar = car;
  }
}

function cleanupStageEntities(G) {
  const m = G.mission;
  if (m.courier) {
    G.peds = G.peds.filter((p) => p !== m.courier);
    m.courier = null;
    m.tailWalker = null;
  }
  G.peds = G.peds.filter((p) => !p.rival);
  if (m.targetCar) {
    m.targetCar.missionCar = false;
    m.targetCar = null;
  }
}

export function failMission(G, reason) {
  const m = G.mission;
  if (!m.active) return;
  cleanupStageEntities(G);
  if (G.race && G.race.forMission) G.race = null;
  G.banner = { title: 'MISSION FAILED', sub: reason, t: 0, ttl: 3.4, bad: true };
  m.active = null;
  m.stageIdx = 0;
  G.audio.bustedSound();
}

export function completeMission(G) {
  const m = G.mission;
  const def = m.active;
  cleanupStageEntities(G);
  G.addCash(def.reward.cash);
  G.addRespect(def.reward.respect);
  G.progress.missionsDone += 1;
  G.banner = {
    title: 'MISSION COMPLETE',
    sub: `${def.name} · +$${def.reward.cash} · +${def.reward.respect} respect`,
    t: 0, ttl: 4.2, bad: false,
  };
  G.audio.jingle();
  G.audio.cashSound();
  m.active = null;
  m.stageIdx = 0;
  if (G.progress.missionsDone >= MISSIONS.length) {
    G.progress.storyDone = true;
    G.banner = {
      title: 'STREETS OF THE SUN',
      sub: 'Story complete — Solmar Bay legend. Free roam, races and discs remain.',
      t: 0, ttl: 6, bad: false,
    };
  }
  G.saveGame();
}

function advanceStage(G) {
  const m = G.mission;
  m.stageIdx += 1;
  if (m.stageIdx >= m.active.stages.length) completeMission(G);
  else setupStage(G);
}

export function updateMissions(G, dt) {
  const m = G.mission;
  if (m.cardT > 0) m.cardT -= dt;
  if (!m.active) {
    tryStartMission(G);
    return;
  }
  const stage = currentStage(G);
  if (!stage) return;
  const p = G.player;
  const point = stagePoint(G, stage);
  const dist = distanceBetween(p.x, p.y, point.x, point.y);

  switch (stage.type) {
    case 'goto':
      if (dist < stage.r) advanceStage(G);
      break;
    case 'drive': {
      if (stage.time) {
        m.stageT -= dt;
        if (m.stageT <= 0) { failMission(G, 'Out of time. The buyer walked away.'); return; }
      }
      if (stage.needMarkedCar) {
        if (m.targetCar && m.targetCar.wrecked) { failMission(G, 'The car is wrecked.'); return; }
        if (p.car !== m.targetCar) break;
        if (stage.minHp && m.targetCar.hp < stage.minHp) {
          failMission(G, 'Too damaged — the collector refuses it.');
          return;
        }
      } else if (!p.car) break;
      if (dist < stage.r) advanceStage(G);
      break;
    }
    case 'steal':
      if (m.targetCar && p.car === m.targetCar) {
        commitCrime(G, 2);
        advanceStage(G);
      }
      break;
    case 'tail':
      updateTailStage(G, dt, stage);
      break;
    case 'fight':
      if (m.rivalsDown >= stage.count) advanceStage(G);
      break;
    case 'race':
      if (!G.race) { /* race module reports through raceFinished below */ }
      break;
    case 'rob':
      if (dist < stage.r && !p.car) {
        m.stageT -= dt;
        if (m.stageT <= 0) {
          G.addCash(1500);
          addPopup(G.fx, p.x, p.y - 26, '+$1500', '#ffe066');
          commitCrime(G, 4);
          advanceStage(G);
        }
      }
      break;
    case 'escape':
      if (dist < stage.r) {
        G.wanted.level = 0;
        G.wanted.quiet = 0;
        advanceStage(G);
      }
      break;
    default:
      break;
  }
}

// Called by the race module when a mission race resolves.
export function onRaceFinished(G, position) {
  const m = G.mission;
  if (!m.active) return;
  const stage = currentStage(G);
  if (!stage || stage.type !== 'race') return;
  if (position === 1) advanceStage(G);
  else failMission(G, `Finished ${position} of 3. Paloma shrugs: win it, or no deal.`);
}

const TAIL_DETECT_RANGE = 62;
const TAIL_LOSE_RANGE = 430;

function updateTailStage(G, dt, stage) {
  const m = G.mission;
  const courier = m.courier;
  const walker = m.tailWalker;
  if (!courier || !walker) return;
  const wp = walker.waypoints[walker.idx];
  if (wp) {
    const d = distanceBetween(courier.x, courier.y, wp.x, wp.y);
    if (d < 16) {
      walker.idx += 1;
      if (walker.idx >= walker.waypoints.length) {
        // The drop: stand close and the package changes hands.
        if (distanceBetween(G.player.x, G.player.y, courier.x, courier.y) < 110) {
          advanceStage(G);
        } else {
          failMission(G, 'The courier made the drop unwatched. The trail is cold.');
        }
        return;
      }
    } else {
      walker.angle = Math.atan2(wp.y - courier.y, wp.x - courier.x);
    }
  }
  const dist = distanceBetween(G.player.x, G.player.y, courier.x, courier.y);
  const spotted = dist < TAIL_DETECT_RANGE && !G.player.car;
  if (spotted) m.detection = clamp(m.detection + dt * 0.42, 0, 1);
  else m.detection = clamp(m.detection - dt * 0.16, 0, 1);
  if (m.detection >= 1) {
    failMission(G, 'Spotted! The courier bolts into the crowd.');
    return;
  }
  if (dist > TAIL_LOSE_RANGE) {
    m.loseT += dt;
    if (m.loseT > 6) {
      failMission(G, 'You lost the courier in the market crowd.');
      return;
    }
  } else {
    m.loseT = 0;
  }
}

// The checklist shown during the harbour shootout mission.
export function missionChecklist(G) {
  const m = G.mission;
  if (!m.active || m.active.id !== 'scorpions') return null;
  const stage = currentStage(G);
  const fightStage = m.active.stages[1];
  return [
    { label: 'Reach the container yard', done: m.stageIdx > 0 },
    { label: `Clear Los Escorpiones (${Math.min(m.rivalsDown, fightStage.count)}/${fightStage.count})`,
      done: m.stageIdx > 1 },
    { label: 'Escape to Casa Solmar', done: false, current: m.stageIdx === 2 },
  ].map((item, i) => ({ ...item, current: item.current || (m.stageIdx === i && !item.done) }));
}
