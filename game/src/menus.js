// menus.js — every full-screen and panel screen the game draws itself:
// the start screen over a panning city, pause, the missions board (J) with
// the whole story chain and the player's stats, the briefing card, the
// mission banner, and the busted / wasted overlays.

import { VIEW_W, VIEW_H, KEYBINDS_TEXT } from './config.js';
import { MISSIONS } from './missions.js';
import { respectLevel } from './world.js';

export function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function panel(ctx, x, y, w, h, alpha) {
  ctx.fillStyle = `rgba(14,18,24,${alpha || 0.88})`;
  ctx.strokeStyle = 'rgba(255,212,59,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();
  ctx.stroke();
}

export function drawStartScreen(ctx, G, time) {
  ctx.fillStyle = 'rgba(20,16,26,0.45)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const w = 620;
  const x = (VIEW_W - w) / 2;
  const y = 74;
  panel(ctx, x, y, w, 566, 0.9);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd43b';
  ctx.font = '900 62px system-ui, sans-serif';
  ctx.fillText('SOLMAR BAY', VIEW_W / 2, y + 84);
  ctx.fillStyle = '#ffe9a8';
  ctx.font = '700 21px system-ui, sans-serif';
  ctx.fillText('— STREETS OF THE SUN —', VIEW_W / 2, y + 120);
  ctx.fillStyle = '#e8e3d8';
  ctx.font = '15px system-ui, sans-serif';
  const intro = [
    'You washed up in Solmar Bay with a duffel bag and a debt.',
    'Run errands for Tía Carmen, earn the trust of the fixer El Faro,',
    'out-drive Paloma, and take Puerto Alba back from Los Escorpiones.',
    'Eight jobs stand between you and legend. The bay is watching.',
  ];
  intro.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, y + 158 + i * 22));
  ctx.fillStyle = '#ffd43b';
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillText('CONTROLS', VIEW_W / 2, y + 268);
  ctx.fillStyle = '#cfd6dd';
  ctx.font = '14px system-ui, sans-serif';
  KEYBINDS_TEXT.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, y + 294 + i * 20));
  if (G.progress.missionsDone > 0 || G.stats.playTime > 5) {
    ctx.fillStyle = '#8ce99a';
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillText(`Saved progress: ${G.progress.missionsDone}/8 missions · $${G.cash} · ${G.progress.discsFound}/12 sun discs`,
      VIEW_W / 2, y + 428);
  }
  // The start button; main.js hit-tests clicks against G.startButton.
  const bw = 240;
  const bh = 52;
  const bx = (VIEW_W - bw) / 2;
  const by = y + 452;
  const glow = 0.75 + Math.sin(time * 3) * 0.25;
  ctx.fillStyle = `rgba(255,176,32,${glow})`;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 10);
  ctx.fill();
  ctx.fillStyle = '#23180a';
  ctx.font = '900 22px system-ui, sans-serif';
  ctx.fillText('START ENGINE', VIEW_W / 2, by + 34);
  G.startButton = { x: bx, y: by, w: bw, h: bh };
  ctx.fillStyle = '#9aa4ad';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('or press Enter', VIEW_W / 2, by + 76);
}

export function drawPauseScreen(ctx, G) {
  ctx.fillStyle = 'rgba(12,14,20,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const w = 430;
  const x = (VIEW_W - w) / 2;
  const y = 190;
  panel(ctx, x, y, w, 300);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd43b';
  ctx.font = '900 38px system-ui, sans-serif';
  ctx.fillText('PAUSED', VIEW_W / 2, y + 62);
  ctx.fillStyle = '#e8e3d8';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('P / Esc — resume', VIEW_W / 2, y + 116);
  ctx.fillText('J — missions board', VIEW_W / 2, y + 146);
  ctx.fillText('M — mute · Progress saves itself', VIEW_W / 2, y + 176);
  ctx.fillStyle = '#9aa4ad';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(`Missions ${G.progress.missionsDone}/8 · Cash $${G.cash} · Respect Lv ${respectLevel(G)}`,
    VIEW_W / 2, y + 226);
  ctx.fillText(`Cars stolen ${G.stats.carsStolen} · Races won ${G.stats.racesWon} · Discs ${G.progress.discsFound}/12`,
    VIEW_W / 2, y + 252);
}

export function drawMissionsBoard(ctx, G) {
  const w = 760;
  const h = 560;
  const x = (VIEW_W - w) / 2;
  const y = (VIEW_H - h) / 2;
  panel(ctx, x, y, w, h, 0.93);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd43b';
  ctx.font = '900 27px system-ui, sans-serif';
  ctx.fillText('MISSIONS — STREETS OF THE SUN', x + 28, y + 44);
  ctx.fillStyle = '#9aa4ad';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('The story chain. Finish one job to unlock the next.', x + 28, y + 68);

  const done = G.progress.missionsDone;
  MISSIONS.forEach((mDef, i) => {
    const rowY = y + 88 + i * 47;
    const state = i < done ? 'done' : i === done ? 'current' : 'locked';
    ctx.fillStyle = state === 'current' ? 'rgba(255,212,59,0.14)' : 'rgba(255,255,255,0.04)';
    ctx.beginPath();
    ctx.roundRect(x + 18, rowY - 24, w - 36, 40, 8);
    ctx.fill();
    // State badge.
    ctx.font = '900 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    if (state === 'done') {
      ctx.fillStyle = '#51cf66';
      ctx.fillText('✓', x + 46, rowY + 4);
    } else if (state === 'current') {
      ctx.fillStyle = '#ffd43b';
      ctx.fillText('▶', x + 46, rowY + 4);
    } else {
      ctx.fillStyle = '#69707a';
      ctx.fillText('✕', x + 46, rowY + 4);
    }
    ctx.textAlign = 'left';
    ctx.font = '700 16.5px system-ui, sans-serif';
    ctx.fillStyle = state === 'locked' ? '#69707a' : '#f2ead8';
    ctx.fillText(`${i + 1}. ${mDef.name}`, x + 72, rowY + 1);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = state === 'locked' ? '#565d66' : '#b9c2cb';
    ctx.fillText(state === 'locked' ? 'Locked — finish the job before it' : `${mDef.giver} · reward $${mDef.reward.cash} + ${mDef.reward.respect} respect`,
      x + 72, rowY + 19);
    ctx.textAlign = 'right';
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillStyle = state === 'done' ? '#51cf66' : state === 'current' ? '#ffd43b' : '#565d66';
    ctx.fillText(state.toUpperCase(), x + w - 30, rowY + 4);
    ctx.textAlign = 'left';
  });

  // Stats row along the bottom of the panel.
  const sy = y + h - 58;
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.moveTo(x + 24, sy - 14);
  ctx.lineTo(x + w - 24, sy - 14);
  ctx.stroke();
  const coursesWon = G.progress.coursesWon ? G.progress.coursesWon.filter(Boolean).length : 0;
  const stats = [
    `Cash $${G.cash}`,
    `Respect Lv ${respectLevel(G)}`,
    `Races won ${coursesWon}/3`,
    `Sun discs ${G.progress.discsFound}/12`,
    `Cars stolen ${G.stats.carsStolen}`,
    `Played ${formatPlayTime(G.stats.playTime)}`,
  ];
  ctx.font = '700 14.5px system-ui, sans-serif';
  ctx.fillStyle = '#ffe9a8';
  const totalW = stats.reduce((sum, s) => sum + ctx.measureText(s).width, 0) + (stats.length - 1) * 26;
  let cx = x + (w - totalW) / 2;
  for (const s of stats) {
    ctx.fillText(s, cx, sy + 12);
    cx += ctx.measureText(s).width + 26;
  }
  ctx.fillStyle = '#9aa4ad';
  ctx.font = '12.5px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('J or Esc — back to the streets', VIEW_W / 2, y + h - 14);
}

export function formatPlayTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function drawBriefingCard(ctx, G) {
  const m = G.mission;
  if (!m.active || m.cardT <= 0) return;
  const def = m.active;
  const w = 400;
  const x = 22;
  const y = 196;
  const alpha = Math.min(1, m.cardT);
  ctx.save();
  ctx.globalAlpha = alpha;
  panel(ctx, x, y, w, 168, 0.92);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd43b';
  ctx.font = '900 19px system-ui, sans-serif';
  ctx.fillText(def.name.toUpperCase(), x + 18, y + 32);
  ctx.fillStyle = '#8ce99a';
  ctx.font = '700 13.5px system-ui, sans-serif';
  ctx.fillText(`${def.giver} · reward $${def.reward.cash} + ${def.reward.respect} respect`, x + 18, y + 54);
  ctx.fillStyle = '#e8e3d8';
  ctx.font = '13.5px system-ui, sans-serif';
  const lines = wrapText(ctx, def.brief, w - 36).slice(0, 5);
  lines.forEach((line, i) => ctx.fillText(line, x + 18, y + 80 + i * 18));
  ctx.restore();
}

export function drawBanner(ctx, G) {
  const b = G.banner;
  if (!b) return;
  const fade = Math.min(1, (b.ttl - b.t) / 0.5, b.t / 0.25 + 0.4);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, fade));
  ctx.textAlign = 'center';
  ctx.font = '900 40px system-ui, sans-serif';
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(16,12,8,0.85)';
  const titleY = 128;
  ctx.strokeText(b.title, VIEW_W / 2, titleY);
  ctx.fillStyle = b.bad ? '#ff8a75' : '#ffd43b';
  ctx.fillText(b.title, VIEW_W / 2, titleY);
  ctx.font = '700 17px system-ui, sans-serif';
  ctx.lineWidth = 5;
  ctx.strokeText(b.sub, VIEW_W / 2, titleY + 30);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(b.sub, VIEW_W / 2, titleY + 30);
  ctx.restore();
}

export function drawBustedScreen(ctx, G) {
  ctx.fillStyle = 'rgba(30,10,10,0.52)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.font = '900 84px system-ui, sans-serif';
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(10,6,6,0.9)';
  ctx.strokeText('BUSTED', VIEW_W / 2, 320);
  ctx.fillStyle = '#ff6b5e';
  ctx.fillText('BUSTED', VIEW_W / 2, 320);
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`The Solmar Bay police fine you $${G.lastFine}. You walk out of Estación Solmar a little poorer.`, VIEW_W / 2, 366);
}

export function drawWastedScreen(ctx, G) {
  ctx.fillStyle = 'rgba(24,8,14,0.58)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.font = '900 84px system-ui, sans-serif';
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(10,6,6,0.9)';
  ctx.strokeText('WASTED', VIEW_W / 2, 320);
  ctx.fillStyle = '#e64980';
  ctx.fillText('WASTED', VIEW_W / 2, 320);
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`Clínica Serena patches you up for $${G.lastLoss}. The bay keeps spinning without you.`, VIEW_W / 2, 366);
}
