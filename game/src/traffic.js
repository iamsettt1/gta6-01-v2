// traffic.js — ordinary Solmar Bay traffic: cars that follow the road grid
// in right-hand lanes, brake for obstacles and the player, slow for turns,
// and occasionally turn at intersections. Also parks the kerbside cars the
// player can steal.

import { randRange, pickFrom, chance, clamp } from './random.js';
import { ROAD_XS, ROAD_YS, ROAD_W, collideCircle } from './city.js';
import { createCar, stepCarPhysics, steerTowards, CAR_CLASSES } from './vehicles.js';
import { SAND_Y, WORLD_W } from './config.js';

const TRAFFIC_KINDS = ['sedan', 'sedan', 'coupe', 'hatch', 'hatch', 'taxi', 'van', 'pickup'];

// Lane offset from a road centre for right-hand traffic.
export function laneOffset(axis, dir) {
  if (axis === 'v') return dir > 0 ? -30 : 30;
  return dir > 0 ? 30 : -30;
}

export function makeTrafficCar(rng, x, y) {
  const kind = pickFrom(rng, TRAFFIC_KINDS);
  const color = pickFrom(rng, CAR_CLASSES[kind].colors);
  const car = createCar(kind, x, y, 0, color);
  car.driver = 'traffic';
  car.parked = false;
  // Snap the car onto the nearest road lane.
  let bestD = 1e9;
  for (const rx of ROAD_XS) {
    const d = Math.abs(rx - x);
    if (d < bestD) { bestD = d; car.axis = 'v'; car.road = rx; }
  }
  for (const ry of ROAD_YS) {
    const d = Math.abs(ry - y);
    if (d < bestD) { bestD = d; car.axis = 'h'; car.road = ry; }
  }
  car.dir = chance(rng, 0.5) ? 1 : -1;
  placeCarOnLane(car);
  car.cruise = randRange(rng, 138, 188);
  car.turnCooldown = randRange(rng, 2, 7);
  return car;
}

function placeCarOnLane(car) {
  const off = laneOffset(car.axis, car.dir);
  if (car.axis === 'v') {
    car.x = car.road + off;
    car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    car.y = car.road + off;
    car.angle = car.dir > 0 ? 0 : Math.PI;
  }
}

function obstacleAhead(G, car, dist) {
  // Project each candidate onto the car's forward axis: only what is
  // genuinely in the lane ahead counts, so kerbside parked cars and
  // pedestrians on the far sidewalk never freeze the traffic.
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const check = (o, lateralMax) => {
    if (o === car) return false;
    const rx = o.x - car.x;
    const ry = o.y - car.y;
    const fwd = rx * fx + ry * fy;
    if (fwd < 6 || fwd > dist) return false;
    const lat = Math.abs(rx * -fy + ry * fx);
    return lat < lateralMax;
  };
  for (const c of G.cars) if (check(c, 24)) return true;
  for (const c of G.policeCars) if (check(c, 24)) return true;
  if (G.player.car && check(G.player.car, 24)) return true;
  if (!G.player.car && check(G.player, 15)) return true;
  for (const ped of G.peds) {
    if (ped.state !== 'down' && check(ped, 15)) return true;
  }
  return false;
}

export function updateTrafficCar(G, car, dt) {
  car.turnCooldown -= dt;
  // The point the car steers for: far ahead, pinned to its lane.
  let tx;
  let ty;
  if (car.axis === 'v') {
    tx = car.road + laneOffset('v', car.dir);
    ty = car.y + car.dir * 150;
  } else {
    tx = car.x + car.dir * 150;
    ty = car.road + laneOffset('h', car.dir);
  }
  const { steer } = steerTowards(car, tx, ty, 0);

  let throttle = 0;
  if (obstacleAhead(G, car, 52)) throttle = car.speed > 24 ? -1 : 0;
  else if (obstacleAhead(G, car, 96)) throttle = car.speed > 60 ? -0.4 : 0.1;
  else if (car.speed < car.cruise) throttle = 0.85;

  stepCarPhysics(G.city, car, dt, throttle, steer, false);

  maybeTurn(G, car);
  keepOnWorld(G, car);
}

function maybeTurn(G, car) {
  if (car.turnCooldown > 0) return;
  const crosses = car.axis === 'v' ? ROAD_YS : ROAD_XS;
  const along = car.axis === 'v' ? car.y : car.x;
  for (const c of crosses) {
    if (Math.abs(along - c) < 24 && chance(G.rng, 0.5)) {
      const oldAxis = car.axis;
      car.axis = oldAxis === 'v' ? 'h' : 'v';
      car.road = c;
      car.dir = chance(G.rng, 0.5) ? 1 : -1;
      // The coordinate along the new axis is the road we turned from.
      if (car.axis === 'h') car.y = c + laneOffset('h', car.dir);
      else car.x = c + laneOffset('v', car.dir);
      car.turnCooldown = randRange(G.rng, 3, 8);
      return;
    }
  }
}

function keepOnWorld(G, car) {
  // At the map edge a traffic car turns around and takes the other lane.
  if (car.axis === 'v' && (car.y < 70 || car.y > SAND_Y - 30)) {
    car.dir *= -1;
    car.x = car.road + laneOffset('v', car.dir);
    car.turnCooldown = 4;
  }
  if (car.axis === 'h' && (car.x < 70 || car.x > WORLD_W - 70)) {
    car.dir *= -1;
    car.y = car.road + laneOffset('h', car.dir);
    car.turnCooldown = 4;
  }
}

// Kerbside parked cars, angled along the road edge, waiting to be stolen.
export function scatterParkedCars(G, count) {
  const rng = G.rng;
  let placed = 0;
  let guard = 0;
  while (placed < count && guard++ < count * 30) {
    const vertical = chance(rng, 0.5);
    const road = vertical ? pickFrom(rng, ROAD_XS) : pickFrom(rng, ROAD_YS);
    const along = vertical ? randRange(rng, 120, SAND_Y - 120) : randRange(rng, 120, WORLD_W - 120);
    const side = chance(rng, 0.5) ? -1 : 1;
    // Parked in the kerb lane, on the road itself, so a stolen car can
    // always pull straight out into the street.
    const off = side * (ROAD_W / 2 - 14);
    const x = vertical ? road + off : along;
    const y = vertical ? along : road + off;
    if (G.cars.some((c) => Math.hypot(c.x - x, c.y - y) < 74)) continue;
    if (collideCircle(G.city, x, y, 24).hit) continue; // never park inside a building
    const kind = pickFrom(rng, TRAFFIC_KINDS.concat(['sports']));
    const car = createCar(kind, x, y, vertical ? Math.PI / 2 : 0, pickFrom(rng, CAR_CLASSES[kind].colors));
    car.driver = null;
    car.parked = true;
    if (!vertical && side < 0) car.angle = Math.PI;
    if (vertical && side > 0) car.angle = -Math.PI / 2;
    G.cars.push(car);
    placed++;
  }
}

export function maintainTraffic(G) {
  const p = G.player;
  G.cars = G.cars.filter((car) => {
    if (car.driver !== 'traffic') return true;
    return Math.hypot(car.x - p.x, car.y - p.y) < 1050;
  });
  const live = G.cars.filter((c) => c.driver === 'traffic').length;
  if (live < 13) {
    const a = randRange(G.rng, 0, Math.PI * 2);
    const d = randRange(G.rng, 560, 880);
    const x = clamp(p.x + Math.cos(a) * d, 80, WORLD_W - 80);
    const y = clamp(p.y + Math.sin(a) * d, 80, SAND_Y - 60);
    G.cars.push(makeTrafficCar(G.rng, x, y));
  }
}
