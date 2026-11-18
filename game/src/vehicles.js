// vehicles.js — the car classes of Solmar Bay, car creation, the driving
// physics step shared by the player, traffic, police and race drivers, and
// the top-down car drawing (body, glass, wheels, lights, damage smoke).

import { clamp, angleDelta } from './random.js';
import { collideCircle } from './city.js';

export const CAR_CLASSES = {
  sedan:    { w: 46, h: 24, topSpeed: 305, accel: 235, grip: 3.4, hp: 100,
              colors: ['#c8ccd2', '#7d8894', '#a63d3d', '#3d5a80', '#4d4d55', '#d8d3c3'] },
  coupe:    { w: 46, h: 23, topSpeed: 345, accel: 275, grip: 3.6, hp: 95,
              colors: ['#8c2f39', '#274156', '#e0a458', '#5b7553', '#31393f'] },
  sports:   { w: 48, h: 23, topSpeed: 415, accel: 340, grip: 3.9, hp: 90,
              colors: ['#e33e2b', '#f2b21b', '#1f9e8e', '#e8e8ec', '#22242a'] },
  hatch:    { w: 41, h: 23, topSpeed: 275, accel: 215, grip: 3.3, hp: 85,
              colors: ['#7fb069', '#bc6c25', '#6d8ea0', '#ccd5ae', '#9b5de5'] },
  taxi:     { w: 46, h: 24, topSpeed: 300, accel: 230, grip: 3.4, hp: 100,
              colors: ['#f6c90e'] },
  van:      { w: 52, h: 26, topSpeed: 255, accel: 185, grip: 3.0, hp: 130,
              colors: ['#e8e6df', '#90a4ae', '#b08968', '#606c38'] },
  pickup:   { w: 50, h: 25, topSpeed: 290, accel: 225, grip: 3.1, hp: 120,
              colors: ['#386641', '#6a994e', '#936639', '#495057'] },
  police:   { w: 47, h: 24, topSpeed: 385, accel: 315, grip: 3.8, hp: 120,
              colors: ['#f2f4f6'] },
};

let nextCarId = 1;

export function createCar(kind, x, y, angle, color) {
  const cls = CAR_CLASSES[kind];
  return {
    id: nextCarId++,
    kind, x, y, angle,
    speed: 0,
    w: cls.w, h: cls.h,
    color: color || cls.colors[0],
    hp: cls.hp, maxHp: cls.hp,
    driver: null,        // 'player' | 'traffic' | 'police' | 'race' | null
    parked: true,
    doorOpen: false,
    wrecked: false,
    flashPhase: Math.random() * 6,
    smokeT: 0,
  };
}

export function carRadius(car) {
  return car.w * 0.46;
}

// One physics step. throttle -1..1, steer -1..1. Returns impact speed when
// the car struck a building this step (0 when it did not).
export function stepCarPhysics(city, car, dt, throttle, steer, handbrake) {
  const cls = CAR_CLASSES[car.kind];
  if (car.wrecked) {
    car.speed = 0;
    return 0;
  }
  const accel = throttle > 0 ? cls.accel : cls.accel * 0.62;
  car.speed += throttle * accel * dt;
  const drag = handbrake ? 2.6 : 0.55;
  car.speed -= car.speed * drag * dt;
  if (throttle === 0) car.speed -= car.speed * 1.4 * dt;
  const reverseTop = -cls.topSpeed * 0.34;
  car.speed = clamp(car.speed, reverseTop, cls.topSpeed);
  if (Math.abs(car.speed) < 2 && throttle === 0) car.speed = 0;

  const steerAuthority = clamp(Math.abs(car.speed) / 90, 0, 1) * (car.speed < 0 ? -1 : 1);
  const turnRate = steer * cls.grip * steerAuthority * (handbrake ? 1.5 : 1);
  car.angle += turnRate * dt;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const before = Math.abs(car.speed);
  const res = collideCircle(city, nx, ny, carRadius(car));
  car.x = res.x;
  car.y = res.y;
  if (res.hit) {
    const impact = before * 0.72;
    car.speed *= 0.25;
    return impact;
  }
  return 0;
}

export function damageCar(car, amount) {
  car.hp -= amount;
  if (car.hp <= 0) {
    car.hp = 0;
    car.wrecked = true;
    car.speed = 0;
  }
}

// Soft circle separation between two cars; returns true on contact.
export function separateCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const minD = carRadius(a) + carRadius(b) - 6;
  const d = Math.hypot(dx, dy);
  if (d === 0 || d >= minD) return false;
  const push = (minD - d) / 2;
  const ux = dx / d;
  const uy = dy / d;
  a.x -= ux * push;
  a.y -= uy * push;
  b.x += ux * push;
  b.y += uy * push;
  const rel = Math.abs(a.speed - b.speed);
  if (rel > 60) {
    damageCar(a, rel * 0.03);
    damageCar(b, rel * 0.03);
    a.speed *= 0.6;
    b.speed *= 0.6;
  }
  return true;
}

export function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const w = car.w;
  const h = car.h;
  // Soft ground shadow.
  ctx.fillStyle = 'rgba(40,30,20,0.28)';
  ctx.beginPath();
  ctx.ellipse(3, 5, w * 0.54, h * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#17181c';
  const ww = 9;
  const wh = 5;
  for (const [wx, wy] of [[-w * 0.30, -h / 2 - 1], [w * 0.30, -h / 2 - 1], [-w * 0.30, h / 2 - wh + 1], [w * 0.30, h / 2 - wh + 1]]) {
    ctx.fillRect(wx - ww / 2, wy, ww, wh);
  }
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 7);
  ctx.fill();
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#22242a';
    ctx.fillRect(-6, -h / 2, 12, h);
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(-4, -4, 8, 8);
  }
  if (car.kind === 'police') {
    ctx.fillStyle = '#22406b';
    ctx.fillRect(-w * 0.18, -h / 2, w * 0.36, h);
  }
  if (car.kind === 'pickup') {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(-w / 2 + 3, -h / 2 + 3, w * 0.34, h - 6);
  }
  if (car.kind === 'van') {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-w * 0.05, -h / 2 + 3, w * 0.4, h - 6);
  }
  // Cabin glass.
  ctx.fillStyle = '#22303c';
  roundRect(ctx, -w * 0.16, -h * 0.36, w * 0.34, h * 0.72, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(190,225,245,0.5)';
  roundRect(ctx, w * 0.06, -h * 0.32, w * 0.10, h * 0.64, 3);
  ctx.fill();
  // Sports spoiler.
  if (car.kind === 'sports') {
    ctx.fillStyle = '#17181c';
    ctx.fillRect(-w / 2 - 2, -h * 0.42, 5, h * 0.84);
  }
  // Open door (the getaway car waits like this).
  if (car.doorOpen) {
    ctx.save();
    ctx.translate(w * 0.08, -h / 2);
    ctx.rotate(-0.9);
    ctx.fillStyle = car.color;
    ctx.fillRect(0, -3, 16, 5);
    ctx.restore();
  }
  // Headlights and taillights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(w / 2 - 2, -h * 0.32, 3, 5);
  ctx.fillRect(w / 2 - 2, h * 0.32 - 5, 3, 5);
  ctx.fillStyle = '#d63a2f';
  ctx.fillRect(-w / 2 - 1, -h * 0.32, 3, 5);
  ctx.fillRect(-w / 2 - 1, h * 0.32 - 5, 3, 5);
  // Police light bar: red and blue halves flash in turn and throw a glow.
  if (car.kind === 'police') {
    const phase = Math.floor(time * 6 + car.flashPhase) % 2;
    const glow = phase === 0 ? 'rgba(255,60,50,0.20)' : 'rgba(60,110,255,0.20)';
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(0, 0, 46, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = phase === 0 ? '#ff3524' : '#5b7a99';
    ctx.fillRect(-8, -h * 0.34, 8, h * 0.30);
    ctx.fillStyle = phase === 1 ? '#2f7bff' : '#7a4a4a';
    ctx.fillRect(0, -h * 0.34, 8, h * 0.30);
    ctx.fillStyle = '#17181c';
    ctx.fillRect(-9, -h * 0.34 - 1, 18, 2);
  }
  // Damage: dents darken the body, a wreck sits grey.
  if (car.hp < car.maxHp * 0.45) {
    ctx.fillStyle = 'rgba(30,28,26,0.35)';
    roundRect(ctx, -w / 2, -h / 2, w, h, 7);
    ctx.fill();
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Steering helper for AI drivers: chase a point, return {throttle, steer}.
export function steerTowards(car, tx, ty, arriveRadius) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  const delta = angleDelta(car.angle, want);
  const steer = clamp(delta * 2.2, -1, 1);
  const dist = Math.hypot(tx - car.x, ty - car.y);
  let throttle = 1;
  if (Math.abs(delta) > 2.2) throttle = -0.6;      // badly turned: back up
  else if (Math.abs(delta) > 1.1) throttle = 0.35;
  if (arriveRadius && dist < arriveRadius) throttle = dist < arriveRadius * 0.4 ? 0 : 0.3;
  return { throttle, steer };
}
