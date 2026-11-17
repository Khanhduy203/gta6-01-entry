// Solmar City — the story: five missions from Dona Vera, the fixer who
// runs the Mar Azul diner. One job: define each mission, track its steps,
// and tell the game what the current objective and waypoint are.
import * as THREE from 'three';
import { dist2D, rand } from './config.js';

// Mission shapes:
//  goto    — reach the waypoint (optionally before a timer runs out)
//  steal   — steal the marked car, then bring it to the garage waypoint
//  survive  — keep the wanted level above zero for N seconds, then lose it
//  combat  — defeat every gang member at the waypoint
//  heist   — collect every package, then reach the hideout, on a timer
export const MISSION_LIST = [
  {
    id: 'first-delivery',
    title: 'First Delivery',
    giver: 'Dona Vera',
    brief: 'Vera needs a package at the marina, fast. Grab any car — press E next to one — and drive to the blue marker.',
    reward: 300,
    steps: [
      { type: 'goto', label: 'Drive to the marina drop-off', x: -117, z: 195, radius: 8 },
    ],
  },
  {
    id: 'borrowed-wheels',
    title: 'Borrowed Wheels',
    giver: 'Dona Vera',
    brief: 'A client wants a yellow Comet GT from the plaza. Take it — the cops will notice — and bring it to Vera\u2019s garage on Calle Ocho.',
    reward: 450,
    steps: [
      { type: 'steal', label: 'Steal the yellow Comet GT at the plaza', x: 39, z: -39, radius: 7 },
      { type: 'goto', label: 'Deliver it to Vera\u2019s garage', x: 117, z: -117, radius: 9 },
    ],
  },
  {
    id: 'heat',
    title: 'Heat',
    giver: 'Dona Vera',
    brief: 'The Solmar PD is on your tail. Lose the heat — get your wanted level to zero — before they drag you in.',
    reward: 500,
    steps: [
      { type: 'survive', label: 'Lose the police — get to zero stars', seconds: 45 },
    ],
  },
  {
    id: 'turf-war',
    title: 'Turf War',
    giver: 'Dona Vera',
    brief: 'Los Lobos are muscling in on the docks. Go to the docks and send them packing. Click to shoot.',
    reward: 700,
    steps: [
      { type: 'combat', label: 'Clear Los Lobos from the docks', x: -195, z: 117, radius: 14, enemies: 4 },
    ],
  },
  {
    id: 'the-big-score',
    title: 'The Big Score',
    giver: 'Dona Vera',
    brief: 'Three drops, one hideout, two and a half minutes. This is the job that buys your freedom, Leo. Don\u2019t be late.',
    reward: 1500,
    steps: [
      { type: 'heist', label: 'Collect all three drops, then reach the hideout', timer: 150,
        drops: [{ x: -156, z: -156 }, { x: 156, z: 39 }, { x: -39, z: 156 }],
        hideout: { x: 78, z: -156 } },
    ],
  },
];

export class MissionManager {
  constructor(scene) {
    this.scene = scene;
    this.index = 0;             // next mission to play
    this.active = null;         // { def, step, ... } while a mission runs
    this.stepTimer = 0;
    this.collected = 0;
    this.gang = [];             // GangMember objects for combat steps
    this.onEvent = null;        // (event, data) — game wires sound/text
    // waypoint beacon: a tall glowing pillar + a floating diamond
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0x35c8ff, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 12, 1, true), beaconMat);
    this.beacon.visible = false;
    scene.add(this.beacon);
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.6),
      new THREE.MeshBasicMaterial({ color: 0x35c8ff }));
    this.marker = diamond;
    this.marker.visible = false;
    scene.add(this.marker);
  }

  get currentDef() { return MISSION_LIST[this.index] || null; }
  get finishedAll() { return this.index >= MISSION_LIST.length; }

  startMission() {
    const def = this.currentDef;
    if (!def || this.active) return false;
    this.active = { def, step: 0 };
    this.stepTimer = 0;
    this.collected = 0;
    this._enterStep();
    this._emit('start', { def });
    return true;
  }

  _enterStep() {
    const step = this.active.def.steps[this.active.step];
    if (step.type === 'survive') {
      this.stepTimer = step.seconds;
      if (this.onEvent) this._emit('heat', {});
    }
    if (step.type === 'heist') this.stepTimer = step.timer;
    this._updateBeacon();
  }

  _updateBeacon() {
    if (!this.active) { this.beacon.visible = false; this.marker.visible = false; return; }
    const step = this.active.def.steps[this.active.step];
    let target = null;
    if (step.type === 'heist') {
      target = this.collected < step.drops.length
        ? step.drops[this.collected] : step.hideout;
    } else if (step.x !== undefined) {
      target = step;
    }
    if (!target) { this.beacon.visible = false; this.marker.visible = false; return; }
    this.beacon.position.set(target.x, 30, target.z);
    this.beacon.visible = true;
    this.marker.position.set(target.x, 8, target.z);
    this.marker.visible = true;
  }

  objectiveText() {
    if (!this.active) {
      if (this.finishedAll) return 'Story complete — Solmar is yours. Free roam: press T for missions.';
      return 'Press T to start the next job: ' + (this.currentDef ? this.currentDef.title : '');
    }
    const step = this.active.def.steps[this.active.step];
    let text = step.label;
    if (step.type === 'survive') text += ' — ' + Math.ceil(this.stepTimer) + 's';
    if (step.type === 'heist') {
      text += ' — ' + this.collected + '/' + step.drops.length + ' drops, ' + Math.ceil(this.stepTimer) + 's left';
    }
    if (step.type === 'combat') {
      const left = this.gang.filter((g) => g.alive).length;
      text += ' — ' + left + ' left';
    }
    return text;
  }

  waypoint() {
    if (!this.active) return null;
    const step = this.active.def.steps[this.active.step];
    if (step.type === 'heist') {
      return this.collected < step.drops.length
        ? step.drops[this.collected] : step.hideout;
    }
    if (step.type === 'survive') return null;
    return { x: step.x, z: step.z };
  }

  // Called every frame; returns 'done' | 'failed' | null.
  update(dt, playerPos, driving, wantedStars) {
    if (!this.active) return null;
    const step = this.active.def.steps[this.active.step];
    this.marker.rotation.y += dt * 2;
    this.marker.position.y = 8 + Math.sin(performance.now() / 300) * 0.6;
    if (step.type === 'goto' || step.type === 'steal') {
      if (dist2D(playerPos.x, playerPos.z, step.x, step.z) < step.radius) {
        // the steal step only counts once Leo is actually driving the car
        if (step.type === 'goto' || driving) return this._advance();
      }
    }
    if (step.type === 'survive') {
      if (wantedStars === 0) return this._complete();
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) return this._fail('The cops caught up with you.');
    }
    if (step.type === 'combat') {
      if (this.gang.length && this.gang.every((g) => !g.alive)) return this._advance();
    }
    if (step.type === 'heist') {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) return this._fail('Too slow — the drops went cold.');
      const target = this.collected < step.drops.length
        ? step.drops[this.collected] : step.hideout;
      if (dist2D(playerPos.x, playerPos.z, target.x, target.z) < 8) {
        if (this.collected < step.drops.length) {
          this.collected++;
          this._emit('pickup', { collected: this.collected });
          this._updateBeacon();
        } else {
          return this._complete();
        }
      }
    }
    return null;
  }

  _advance() {
    this.active.step++;
    if (this.active.step >= this.active.def.steps.length) return this._complete();
    this._enterStep();
    this._emit('step', { step: this.active.step });
    return null;
  }

  _complete() {
    const def = this.active.def;
    this.active = null;
    this.beacon.visible = false;
    this.marker.visible = false;
    this.index++;
    this._emit('done', { def });
    return 'done';
  }

  _fail(reason) {
    const def = this.active.def;
    this.active = null;
    this.beacon.visible = false;
    this.marker.visible = false;
    this._emit('fail', { def, reason });
    return 'failed';
  }

  abort() {
    if (!this.active) return;
    this.active = null;
    this.beacon.visible = false;
    this.marker.visible = false;
    for (const g of this.gang) this.scene.remove(g.mesh);
    this.gang = [];
  }

  _emit(event, data) { if (this.onEvent) this.onEvent(event, data); }
}
