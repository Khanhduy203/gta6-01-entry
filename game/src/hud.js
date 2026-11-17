// Solmar City — the HUD: health, money, wanted stars, objective text,
// speed, and the minimap. One job: turn game state into what the player
// sees on screen, every frame.
import { WANTED, HALF, ROAD_CENTERS, BLOCK_CENTERS } from './config.js';

export class Hud {
  constructor() {
    this.el = {
      health: document.getElementById('health-fill'),
      healthText: document.getElementById('health-text'),
      money: document.getElementById('money'),
      stars: document.getElementById('stars'),
      objective: document.getElementById('objective'),
      objectiveTitle: document.getElementById('objective-title'),
      speed: document.getElementById('speed'),
      speedLabel: document.getElementById('speed-label'),
      hint: document.getElementById('hint'),
      toast: document.getElementById('toast'),
      crosshair: document.getElementById('crosshair'),
      wanted: document.getElementById('wanted'),
    };
    this.minimap = document.getElementById('minimap');
    this.mm = this.minimap.getContext('2d');
    this.toastTimer = null;
    this._lastStars = -1;
  }

  toast(text, ms) {
    this.el.toast.textContent = text;
    this.el.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast.classList.remove('show'), ms || 3200);
  }

  setObjective(title, text) {
    this.el.objectiveTitle.textContent = title;
    this.el.objective.textContent = text;
  }

  update(state) {
    const { health, money, stars, speedKmh, driving, bustedTimer } = state;
    this.el.health.style.width = Math.max(0, health) + '%';
    this.el.healthText.textContent = Math.ceil(Math.max(0, health)) + ' HP';
    this.el.money.textContent = '$' + Math.floor(money).toLocaleString('en-US');
    if (stars !== this._lastStars) {
      this._lastStars = stars;
      this.el.stars.textContent = '★'.repeat(stars) + '☆'.repeat(WANTED.maxStars - stars);
      this.el.wanted.classList.toggle('hot', stars > 0);
    }
    this.el.speed.textContent = driving ? Math.round(Math.abs(speedKmh)) : '';
    this.el.speedLabel.textContent = driving ? 'km/h' : '';
    this.el.crosshair.style.display = (!driving && state.armed) ? 'block' : 'none';
    if (bustedTimer > 0) {
      this.el.hint.textContent = 'THE COPS ARE GRABBING YOU — MOVE! ' + bustedTimer.toFixed(1) + 's';
      this.el.hint.classList.add('danger');
    } else {
      this.el.hint.classList.remove('danger');
      this.el.hint.textContent = driving
        ? 'W/S drive · A/D steer · Space handbrake · E exit car · C camera'
        : 'WASD move · Shift sprint · Space jump · E enter car · Click shoot · T mission · M mute';
    }
  }

  // Top-down map: roads, parks, beach, player arrow, traffic, police,
  // gang members and the mission waypoint.
  drawMinimap(state) {
    const g = this.mm;
    const S = 168; // canvas pixels
    const scale = S / (HALF * 2 + 60);
    const toMap = (x, z) => [(x + HALF + 30) * scale, (z + HALF + 30) * scale];
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#20242a';
    g.fillRect(0, 0, S, S);
    // parks
    g.fillStyle = '#3f7a34';
    for (const [bx, bz] of [[-78, -78], [78, 78]]) {
      const [x, y] = toMap(bx - 32, bz - 32);
      g.fillRect(x, y, 64 * scale, 64 * scale);
    }
    // beach + ocean
    g.fillStyle = '#e8d49a';
    const [bx0, by0] = toMap(-HALF, 202);
    g.fillRect(bx0, by0, HALF * 2 * scale, 30 * scale);
    g.fillStyle = '#2a7ab8';
    const [ox, oy] = toMap(-HALF, 232);
    g.fillRect(ox, oy, HALF * 2 * scale, 30 * scale);
    // roads
    g.fillStyle = '#4a4d52';
    for (const c of ROAD_CENTERS) {
      const [x] = toMap(c - 7, 0);
      g.fillRect(x, 0, 14 * scale, S);
      const [, y] = toMap(0, c - 7);
      g.fillRect(0, y, S, 14 * scale);
    }
    // tower
    g.fillStyle = '#7fb8c9';
    const [tx, ty] = toMap(-13, -13);
    g.fillRect(tx, ty, 26 * scale, 26 * scale);
    // waypoint diamond
    if (state.waypoint) {
      const [wx, wy] = toMap(state.waypoint.x, state.waypoint.z);
      g.fillStyle = '#35c8ff';
      g.save();
      g.translate(wx, wy);
      g.rotate(Math.PI / 4);
      const s = 5 + Math.sin(performance.now() / 200) * 1.5;
      g.fillRect(-s, -s, s * 2, s * 2);
      g.restore();
    }
    // traffic dots
    g.fillStyle = '#e8e8e8';
    for (const t of state.traffic) {
      const [x, y] = toMap(t.x, t.z);
      g.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // gang members
    g.fillStyle = '#ff4040';
    for (const e of state.gang) {
      if (!e.alive) continue;
      const [x, y] = toMap(e.x, e.z);
      g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
    }
    // police
    g.fillStyle = '#2244ff';
    for (const p of state.police) {
      const [x, y] = toMap(p.x, p.z);
      g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill();
    }
    // player arrow
    const [px, py] = toMap(state.player.x, state.player.z);
    g.save();
    g.translate(px, py);
    g.rotate(state.heading);
    g.fillStyle = '#ffe14d';
    g.beginPath();
    g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6);
    g.closePath(); g.fill();
    g.restore();
    // north tick
    g.fillStyle = '#ffffff';
    g.font = 'bold 10px sans-serif';
    g.fillText('N', S / 2 - 3, 11);
  }
}
