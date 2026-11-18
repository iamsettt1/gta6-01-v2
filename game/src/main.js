// main.js — boots Solmar Bay: canvas, input, audio, the game loop, the
// screen state machine (title, play, pause, missions board, busted, wasted),
// and the deterministic ?shot= scenes the screenshots are taken from.
// Live state is exposed on window.__game for testing and tooling.

import { VIEW_W, VIEW_H } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createGame, updateGame, computeMouseWorld } from './world.js';
import { renderGame } from './render.js';
import {
  drawStartScreen, drawPauseScreen, drawMissionsBoard,
  drawBriefingCard, drawBanner, drawBustedScreen, drawWastedScreen,
} from './menus.js';
import { SHOT_SCENES } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 7) || 7;
const shotName = params.get('shot');

const input = createInput(canvas);
input.attach();
const audio = createAudio();
const game = createGame(seed, input, audio);
window.__game = game;

let lastTime = performance.now();
let titlePan = 0;

function startPlaying() {
  if (game.screen !== 'title') return;
  game.screen = 'play';
  audio.unlock();
}

function handleScreenKeys() {
  const pressed = (code) => input.wasPressed(code);
  if (game.screen === 'title') {
    if (pressed('Enter') || pressed('Space')) startPlaying();
    if (input.clicked && game.startButton) {
      const b = game.startButton;
      if (input.mouseX >= b.x && input.mouseX <= b.x + b.w &&
          input.mouseY >= b.y && input.mouseY <= b.y + b.h) startPlaying();
    }
    return;
  }
  if (pressed('KeyM')) audio.toggleMute();
  if (game.screen === 'play') {
    if (pressed('KeyJ')) game.screen = 'board';
    else if (pressed('KeyP') || pressed('Escape')) game.screen = 'pause';
  } else if (game.screen === 'board') {
    if (pressed('KeyJ') || pressed('Escape')) game.screen = 'play';
  } else if (game.screen === 'pause') {
    if (pressed('KeyP') || pressed('Escape')) game.screen = 'play';
    else if (pressed('KeyJ')) game.screen = 'board';
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
  lastTime = now;
  computeMouseWorld(game);
  handleScreenKeys();

  if (game.screen === 'play') {
    updateGame(game, dt);
  } else if (game.screen === 'busted' || game.screen === 'wasted') {
    game.overlayT -= dt;
    if (game.overlayT <= 0) game.screen = 'play';
  } else if (game.screen === 'title') {
    // The title floats over a slow pan across the bay.
    titlePan += dt * 26;
    game.camera.x = 1500 + Math.sin(titlePan * 0.011) * 1050;
    game.camera.y = 1900 + Math.cos(titlePan * 0.008) * 760;
    game.camera.zoom = 0.94;
    game.time += dt;
  }

  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  renderGame(ctx, game);
  if (game.screen === 'play') {
    drawBriefingCard(ctx, game);
    drawBanner(ctx, game);
  } else if (game.screen === 'title') {
    drawStartScreen(ctx, game, game.time);
  } else if (game.screen === 'pause') {
    drawPauseScreen(ctx, game);
  } else if (game.screen === 'board') {
    drawMissionsBoard(ctx, game);
  } else if (game.screen === 'busted') {
    drawBustedScreen(ctx, game);
  } else if (game.screen === 'wasted') {
    drawWastedScreen(ctx, game);
  }

  const status = document.getElementById('status');
  if (status) {
    status.textContent = game.screen === 'title'
      ? 'Solmar Bay — Streets of the Sun. Press Enter to play.'
      : `Cash $${game.cash}, wanted level ${game.wanted.level}, health ${Math.round(game.player.hp)}.`;
  }
  input.endFrame();
  requestAnimationFrame(frame);
}

// Screenshot mode: stage the named scene, paint twice, signal readiness.
if (shotName && SHOT_SCENES[shotName]) {
  SHOT_SCENES[shotName](game);
  computeMouseWorld(game);
  renderGame(ctx, game);
  if (shotName === 'progress') drawMissionsBoard(ctx, game);
  renderGame(ctx, game);
  if (shotName === 'progress') drawMissionsBoard(ctx, game);
  if (shotName === 'combat') drawBriefingCard(ctx, game);
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}
