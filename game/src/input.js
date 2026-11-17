// Solmar City — input: keyboard state and mouse camera orbit.
// One job: turn key presses and mouse drags into a clean input object
// the player and camera read every frame.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.forward = false; this.back = false;
    this.left = false; this.right = false;
    this.sprint = false; this.jump = false; this.handbrake = false;
    this.shoot = false;
    // edge-triggered actions, consumed by the game loop
    this.pressed = new Set();
    // camera orbit from mouse drag
    this.yawDelta = 0;
    this.pitchDelta = 0;
    this.dragging = false;
    this.lastX = 0; this.lastY = 0;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      this._refresh();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this._refresh();
    });
    window.addEventListener('blur', () => { this.keys.clear(); this._refresh(); });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.shoot = true;
        this.dragging = true;
        this.lastX = e.clientX; this.lastY = e.clientY;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) { this.shoot = false; this.dragging = false; }
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      this.yawDelta -= (e.clientX - this.lastX) * 0.005;
      this.pitchDelta -= (e.clientY - this.lastY) * 0.004;
      this.lastX = e.clientX; this.lastY = e.clientY;
    });
    // right-drag also orbits without shooting
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2) { this.dragging = true; this.lastX = e.clientX; this.lastY = e.clientY; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.dragging = false;
    });
  }

  _refresh() {
    const k = this.keys;
    this.forward = k.has('KeyW') || k.has('ArrowUp');
    this.back = k.has('KeyS') || k.has('ArrowDown');
    this.left = k.has('KeyA') || k.has('ArrowLeft');
    this.right = k.has('KeyD') || k.has('ArrowRight');
    this.sprint = k.has('ShiftLeft') || k.has('ShiftRight');
    this.jump = k.has('Space');
    this.handbrake = k.has('Space');
  }

  // True once for the frame the key went down; call once per frame.
  wasPressed(code) { return this.pressed.has(code); }
  endFrame() {
    this.pressed.clear();
    this.yawDelta = 0;
    this.pitchDelta = 0;
  }
}
