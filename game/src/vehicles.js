// Solmar City — cars: the low-poly car model factory, traffic that drives
// the road grid, and the player-driven car physics. One job: everything
// with four wheels.
import * as THREE from 'three';
import {
  CAR, TRAFFIC_SPEED, ROAD_CENTERS, HALF, clamp, rand, pick, angleLerp, dist2D,
} from './config.js';

const CAR_COLORS = [0xd93a3a, 0x3a6fd9, 0xe8c33a, 0x3ad97a, 0xe8e8e8, 0x222222, 0xd97ab8, 0x7a5ad9, 0x3ad9d9];

// A boxy low-poly car: body, cabin, four wheels, headlights, taillights.
export function buildCarMesh(color, isPolice) {
  const g = new THREE.Group();
  g.userData.color = color;
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.userData.isBody = true;
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), glassMat);
  cabin.position.set(0, 1.1, -0.25);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.38, z);
    g.add(w);
    wheels.push(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const x of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), lightMat);
    h.position.set(x, 0.6, 2.21);
    g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xd91a1a });
  for (const x of [-0.6, 0.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), tailMat);
    t.position.set(x, 0.6, -2.21);
    g.add(t);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    bar.position.set(0, 1.45, -0.25);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.42),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.3, 1.55, -0.25);
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.42),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blue.position.set(0.3, 1.55, -0.25);
    g.add(blue);
    g.userData.lightBar = { red, blue };
  }
  g.userData.wheels = wheels;
  return g;
}

export class TrafficCar {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.mesh = buildCarMesh(pick(CAR_COLORS), false);
    scene.add(this.mesh);
    this.speed = 0;
    this.targetSpeed = rand(TRAFFIC_SPEED * 0.7, TRAFFIC_SPEED);
    // start on a random road, heading along it
    const horizontal = Math.random() < 0.5;
    const road = pick(ROAD_CENTERS);
    const along = rand(-180, 180);
    if (horizontal) { this.x = along; this.z = road + 3.5; this.heading = Math.PI / 2; }
    else { this.x = road + 3.5; this.z = along; this.heading = 0; }
    this.wait = 0;
    this.stopped = false;
  }

  // Drive along the current road; at an intersection pick a new direction.
  update(dt, cars) {
    if (this.wait > 0) { this.wait -= dt; this.speed = 0; this._syncMesh(); return; }
    // simple follow logic: slow down if a car is close ahead
    let ahead = Infinity;
    for (const other of cars) {
      if (other === this) continue;
      const d = dist2D(this.x, this.z, other.x, other.z);
      if (d < 12) {
        const dx = other.x - this.x, dz = other.z - this.z;
        const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
        if (dx * fx + dz * fz > 0) ahead = Math.min(ahead, d);
      }
    }
    const want = ahead < 9 ? 0 : this.targetSpeed;
    this.speed += clamp(want - this.speed, -14 * dt, 8 * dt);
    const step = this.speed * dt;
    this.x += Math.sin(this.heading) * step;
    this.z += Math.cos(this.heading) * step;
    // reached an intersection? turn onto another road
    for (const c of ROAD_CENTERS) {
      if (Math.abs(this.x - c) < 1.2 && Math.abs(this.z - c) < 1.2) {
        if (Math.random() < 0.45) this._turnAt(c);
        break;
      }
    }
    // wrap around the city edge instead of driving off the map
    if (Math.abs(this.x) > HALF + 6 || Math.abs(this.z) > HALF + 6) {
      this.x = clamp(this.x, -HALF, HALF);
      this.z = clamp(this.z, -HALF, HALF);
      this.heading += Math.PI;
    }
    this._syncMesh();
  }

  _turnAt(c) {
    // At intersection (c, c) of two roads: pick a new heading, snapping the
    // car onto the correct lane of the new road.
    const choices = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
    const h = pick(choices);
    this.heading = h;
    const lane = 3.5;
    if (h === 0) { this.x = c + lane; }
    else if (h === Math.PI) { this.x = c - lane; }
    else if (h === Math.PI / 2) { this.z = c + lane; }
    else { this.z = c - lane; }
    this.wait = rand(0, 1.2);
  }

  _syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * 0.016;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
  }
}

// The car the player drives: arcade physics, building collision, ramming.
export class PlayerCar {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.mesh = null;
    this.x = 0; this.z = 0; this.heading = 0;
    this.speed = 0;
    this.active = false;
    this.color = 0xd93a3a;
  }

  enter(x, z, heading, color) {
    if (!this.mesh) {
      this.mesh = buildCarMesh(color || 0xd93a3a, false);
      this.scene.add(this.mesh);
    }
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0;
    this.active = true;
    this.mesh.visible = true;
    this.color = color || 0xd93a3a;
  }

  exit() { this.active = false; if (this.mesh) this.mesh.visible = false; }

  update(dt, input, traffic, onCrash) {
    if (!this.active) return;
    const fwd = input.forward ? 1 : 0;
    const back = input.back ? 1 : 0;
    if (fwd) this.speed += CAR.accel * dt;
    if (back) this.speed -= (this.speed > 0.5 ? CAR.brake : CAR.accel * 0.6) * dt;
    // drag + rolling resistance
    this.speed -= this.speed * 0.55 * dt;
    if (!fwd && !back) this.speed -= this.speed * 1.4 * dt;
    if (input.handbrake) this.speed -= this.speed * 4 * dt;
    this.speed = clamp(this.speed, -CAR.reverseSpeed, CAR.maxSpeed);
    const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const steerFactor = clamp(Math.abs(this.speed) / 8, 0, 1);
    this.heading += steerInput * CAR.steer * steerFactor * dt * (this.speed >= 0 ? 1 : -1);
    // lateral grip: kill sideways slide
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    const px = this.x, pz = this.z;
    this.x = clamp(nx, -HALF - 4, HALF + 4);
    this.z = clamp(nz, -HALF - 4, 235);
    const hitWall = this.city.resolveCircle(this, CAR.radius);
    if (hitWall) {
      if (Math.abs(this.speed) > 8 && onCrash) onCrash(Math.abs(this.speed) / CAR.maxSpeed);
      this.speed *= 0.35;
    }
    // ram traffic cars out of the way
    for (const t of traffic) {
      const d = dist2D(this.x, this.z, t.x, t.z);
      if (d < CAR.radius + 2 && d > 0.01) {
        const push = (CAR.radius + 2 - d);
        t.x += ((t.x - this.x) / d) * push;
        t.z += ((t.z - this.z) / d) * push;
        t.speed = Math.max(t.speed, Math.abs(this.speed) * 0.4);
        if (Math.abs(this.speed) > 10 && onCrash) onCrash(0.4);
      }
    }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * 0.05;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
  }
}
