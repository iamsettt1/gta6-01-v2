// input.js — keyboard and mouse state for the game.
// One Input object is created by main.js and shared: modules read held keys,
// edge-triggered presses and the mouse aim point (in screen space).

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const input = {
    mouseX: 640,
    mouseY: 360,
    mouseDown: false,
    clicked: false,

    isDown(code) {
      return held.has(code);
    },
    wasPressed(code) {
      return pressed.has(code);
    },
    // Movement axes from WASD or the arrow keys, each in -1..1.
    moveAxis() {
      let x = 0;
      let y = 0;
      if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
      if (held.has('KeyW') || held.has('ArrowUp')) y -= 1;
      if (held.has('KeyS') || held.has('ArrowDown')) y += 1;
      return { x, y };
    },
    // Called once per frame after the update has consumed edge presses.
    endFrame() {
      pressed.clear();
      input.clicked = false;
    },
    attach() {
      window.addEventListener('keydown', (ev) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) {
          ev.preventDefault();
        }
        if (!ev.repeat) pressed.add(ev.code);
        held.add(ev.code);
      });
      window.addEventListener('keyup', (ev) => {
        held.delete(ev.code);
      });
      window.addEventListener('blur', () => {
        held.clear();
        input.mouseDown = false;
      });
      canvas.addEventListener('mousemove', (ev) => {
        const rect = canvas.getBoundingClientRect();
        input.mouseX = ((ev.clientX - rect.left) / rect.width) * canvas.width;
        input.mouseY = ((ev.clientY - rect.top) / rect.height) * canvas.height;
      });
      canvas.addEventListener('mousedown', (ev) => {
        if (ev.button === 0) {
          input.mouseDown = true;
          input.clicked = true;
        }
      });
      window.addEventListener('mouseup', (ev) => {
        if (ev.button === 0) input.mouseDown = false;
      });
      canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
    },
  };
  return input;
}
