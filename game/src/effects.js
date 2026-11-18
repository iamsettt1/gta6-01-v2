// effects.js — transient visual life: particles (sparks, smoke, dust,
// sparkles), fading tyre skid marks, floating text popups, and the day-cycle
// light tint that warms the whole frame as the clock runs to dusk.

import { clamp } from './random.js';

export function createEffects() {
  return {
    particles: [],
    skids: [],
    popups: [],
    tracers: [],
  };
}

export function spawnParticles(fx, x, y, opts) {
  const count = opts.count || 8;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (opts.speed || 90) * (0.3 + Math.random() * 0.9);
    fx.particles.push({
      x, y,
      vx: Math.cos(a) * sp + (opts.vx || 0),
      vy: Math.sin(a) * sp + (opts.vy || 0),
      life: 0,
      ttl: (opts.ttl || 0.5) * (0.6 + Math.random() * 0.7),
      size: (opts.size || 3) * (0.6 + Math.random() * 0.8),
      color: opts.color || '#ffd76a',
      gravity: opts.gravity || 0,
      drag: opts.drag || 1.5,
    });
  }
}

export function burstSparks(fx, x, y) {
  spawnParticles(fx, x, y, { count: 9, speed: 210, ttl: 0.32, size: 2.4, color: '#ffc94d' });
  spawnParticles(fx, x, y, { count: 4, speed: 120, ttl: 0.25, size: 2, color: '#fff3c4' });
}

export function puffSmoke(fx, x, y, dark) {
  spawnParticles(fx, x, y, {
    count: 3, speed: 26, ttl: 0.9, size: 7,
    color: dark ? 'rgba(52,50,48,0.55)' : 'rgba(210,205,195,0.5)', drag: 0.6,
  });
}

export function dustPuff(fx, x, y) {
  spawnParticles(fx, x, y, { count: 4, speed: 44, ttl: 0.6, size: 5, color: 'rgba(226,204,160,0.6)' });
}

export function pickupSparkle(fx, x, y, color) {
  spawnParticles(fx, x, y, { count: 12, speed: 70, ttl: 0.55, size: 3, color: color || '#ffe066', gravity: -60 });
}

export function addPopup(fx, x, y, text, color) {
  fx.popups.push({ x, y, text, color: color || '#ffffff', life: 0, ttl: 1.5 });
}

export function addTracer(fx, x1, y1, x2, y2, color) {
  fx.tracers.push({ x1, y1, x2, y2, life: 0, ttl: 0.09, color: color || '#ffe9a8' });
}

export function laySkid(fx, x, y, angle) {
  fx.skids.push({ x, y, angle, life: 0, ttl: 16 });
  if (fx.skids.length > 700) fx.skids.splice(0, fx.skids.length - 700);
}

export function updateEffects(fx, dt) {
  for (const p of fx.particles) {
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.gravity * dt;
    const d = Math.max(0, 1 - p.drag * dt);
    p.vx *= d;
    p.vy *= d;
  }
  fx.particles = fx.particles.filter((p) => p.life < p.ttl);
  for (const s of fx.skids) s.life += dt;
  fx.skids = fx.skids.filter((s) => s.life < s.ttl);
  for (const p of fx.popups) {
    p.life += dt;
    p.y -= 26 * dt;
  }
  fx.popups = fx.popups.filter((p) => p.life < p.ttl);
  for (const t of fx.tracers) t.life += dt;
  fx.tracers = fx.tracers.filter((t) => t.life < t.ttl);
}

export function drawSkids(ctx, fx) {
  ctx.fillStyle = 'rgba(35,32,30,1)';
  for (const s of fx.skids) {
    const a = 0.34 * (1 - s.life / s.ttl);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.fillRect(-7, -2.4, 14, 4.8);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

export function drawParticles(ctx, fx) {
  for (const p of fx.particles) {
    const t = 1 - p.life / p.ttl;
    ctx.globalAlpha = Math.min(1, t * 1.4);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + t * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const t of fx.tracers) {
    ctx.globalAlpha = 1 - t.life / t.ttl;
    ctx.strokeStyle = t.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function drawPopups(ctx, fx) {
  ctx.textAlign = 'center';
  ctx.font = '700 15px system-ui, sans-serif';
  for (const p of fx.popups) {
    ctx.globalAlpha = 1 - p.life / p.ttl;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(20,16,10,0.8)';
    ctx.strokeText(p.text, p.x, p.y);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

// The light of the day: returns an overlay colour and strength for a clock
// given in minutes. Midday is clear, late afternoon turns gold, dusk deepens.
export function dayTint(clockMin) {
  const h = clockMin / 60;
  if (h < 15) return { color: '255,244,214', alpha: 0.05 };
  if (h < 17.5) {
    const t = (h - 15) / 2.5;
    return { color: '255,196,110', alpha: 0.06 + t * 0.10 };
  }
  if (h < 19.5) {
    const t = (h - 17.5) / 2;
    return { color: '255,150,70', alpha: 0.16 + t * 0.10 };
  }
  return { color: '70,80,140', alpha: 0.26 };
}

export function isDusk(clockMin) {
  return clockMin / 60 >= 17.5;
}

export function formatClock(clockMin) {
  const m = Math.floor(clockMin) % (24 * 60);
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export { clamp };
