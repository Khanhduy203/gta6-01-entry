// Solmar City — the wanted level and the Solmar Police Department.
// One job: track the player's heat, spawn police cars and officers who
// chase the player, and decide when the player is busted.
import * as THREE from 'three';
import {
  WANTED, ROAD_CENTERS, HALF, clamp, rand, pick, dist2D,
} from './config.js';
import { buildCarMesh } from './vehicles.js';
import { buildPersonMesh } from './pedestrians.js';

class PoliceCar {
  constructor(scene) {
    this.scene = scene;
    this.mesh = buildCarMesh(0xf0f0f0, true);
    this.mesh.children.forEach(() => {});
    scene.add(this.mesh);
    this.x = 0; this.z = 0; this.heading = 0;
    this.speed = 0;
    this.active = false;
    this.flash = 0;
  }

  spawnNear(px, pz) {
    // appear on a road a short way from the player
    const road = pick(ROAD_CENTERS);
    const horizontal = Math.random() < 0.5;
    const off = pick([-1, 1]) * rand(35, 60);
    if (horizontal) { this.x = clamp(px + off, -190, 190); this.z = road + 3.5; }
    else { this.x = road + 3.5; this.z = clamp(pz + off, -190, 190); }
    this.heading = Math.atan2(px - this.x, pz - this.z);
    this.speed = 12;
    this.active = true;
    this.mesh.visible = true;
  }

  update(dt, px, pz, playerSpeed) {
    if (!this.active) return;
    // steer toward the player, arcade style
    const want = Math.atan2(px - this.x, pz - this.z);
    let d = want - this.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.heading += clamp(d, -2.2 * dt, 2.2 * dt);
    const dist = dist2D(this.x, this.z, px, pz);
    const target = dist > 26 ? WANTED.copCarSpeed : WANTED.copCarSpeed * 0.75;
    this.speed += clamp(target - this.speed, -18 * dt, 12 * dt);
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
    this.x = clamp(this.x, -HALF - 4, HALF + 4);
    this.z = clamp(this.z, -HALF - 4, 210);
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // flashing light bar
    this.flash += dt * 9;
    const bar = this.mesh.userData.lightBar;
    if (bar) {
      const on = Math.sin(this.flash) > 0;
      bar.red.material.color.setHex(on ? 0xff2222 : 0x551111);
      bar.blue.material.color.setHex(on ? 0x222255 : 0x2244ff);
    }
  }

  despawn() {
    this.active = false;
    this.mesh.visible = false;
  }
}

class PoliceOfficer {
  constructor(scene) {
    this.scene = scene;
    this.mesh = buildPersonMesh(0x1a3a6a, 0xe8b88a);
    const hat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.32, 0.14, 8),
      new THREE.MeshLambertMaterial({ color: 0x0a1a3a }));
    hat.position.y = 1.94;
    this.mesh.add(hat);
    scene.add(this.mesh);
    this.x = 0; this.z = 0;
    this.active = false;
    this.speed = 6.4;
  }

  spawnNear(px, pz) {
    const a = rand(0, Math.PI * 2);
    this.x = clamp(px + Math.cos(a) * rand(22, 34), -195, 195);
    this.z = clamp(pz + Math.sin(a) * rand(22, 34), -195, 205);
    this.active = true;
    this.mesh.visible = true;
  }

  update(dt, px, pz) {
    if (!this.active) return;
    const d = dist2D(this.x, this.z, px, pz);
    if (d > 0.5) {
      const nx = (px - this.x) / d, nz = (pz - this.z) / d;
      this.x += nx * this.speed * dt;
      this.z += nz * this.speed * dt;
      this.mesh.rotation.y = Math.atan2(nx, nz);
      const bob = Math.sin(performance.now() / 120 + this.x) * 0.05;
      this.mesh.position.set(this.x, Math.abs(bob), this.z);
    }
    return d;
  }

  despawn() {
    this.active = false;
    this.mesh.visible = false;
  }
}

export class PoliceForce {
  constructor(scene) {
    this.scene = scene;
    this.stars = 0;
    this.decayTimer = 0;
    this.bustedTimer = 0;
    this.cars = [];
    this.officers = [];
    for (let i = 0; i < 6; i++) {
      const car = new PoliceCar(scene);
      car.mesh.visible = false;
      this.cars.push(car);
    }
    for (let i = 0; i < 4; i++) {
      const off = new PoliceOfficer(scene);
      off.mesh.visible = false;
      this.officers.push(off);
    }
  }

  addStars(n, reason) {
    if (this.stars >= WANTED.maxStars) return;
    this.stars = Math.min(WANTED.maxStars, this.stars + n);
    this.decayTimer = WANTED.decaySeconds;
    this._syncUnits();
    return reason;
  }

  clear() {
    this.stars = 0;
    this.bustedTimer = 0;
    this._syncUnits();
  }

  // Keep the number of active units proportional to the wanted level.
  _syncUnits() {
    const wantCars = WANTED.copsPerStar[this.stars];
    let activeCars = 0;
    for (const c of this.cars) {
      if (c.active) activeCars++;
      if (activeCars > wantCars && c.active) c.despawn();
    }
    const wantOfficers = this.stars >= 2 ? Math.min(4, this.stars - 1) : 0;
    let activeOff = 0;
    for (const o of this.officers) {
      if (o.active) activeOff++;
      if (activeOff > wantOfficers && o.active) o.despawn();
    }
  }

  update(dt, playerPos, driving, playerSpeed) {
    // heat fades when the player stays clean
    if (this.stars > 0) {
      this.decayTimer -= dt;
      if (this.decayTimer <= 0) {
        this.stars--;
        this.decayTimer = WANTED.decaySeconds;
        this._syncUnits();
      }
    }
    if (this.stars === 0) {
      this.bustedTimer = 0;
      return 'clear';
    }
    // spawn fresh units up to the wanted count, near the player
    const wantCars = WANTED.copsPerStar[this.stars];
    for (const c of this.cars) {
      if (!c.active && this.cars.filter((x) => x.active).length < wantCars) {
        c.spawnNear(playerPos.x, playerPos.z);
      }
    }
    const wantOfficers = this.stars >= 2 ? Math.min(4, this.stars - 1) : 0;
    for (const o of this.officers) {
      if (!o.active && this.officers.filter((x) => x.active).length < wantOfficers) {
        o.spawnNear(playerPos.x, playerPos.z);
      }
    }
    // move units; cops far away give up and despawn
    let closest = Infinity;
    for (const c of this.cars) {
      if (!c.active) continue;
      c.update(dt, playerPos.x, playerPos.z, playerSpeed);
      const d = dist2D(c.x, c.z, playerPos.x, playerPos.z);
      closest = Math.min(closest, d);
      if (d > 160) c.despawn();
    }
    for (const o of this.officers) {
      if (!o.active) continue;
      const d = o.update(dt, playerPos.x, playerPos.z);
      closest = Math.min(closest, d);
      if (d > 120) o.despawn();
    }
    // busted: a cop stays within arm's reach
    const bustedRange = driving ? 4.5 : 3.2;
    if (closest < bustedRange) {
      if (driving && playerSpeed > 6) {
        // moving fast in a car: cops cannot grab the player
        this.bustedTimer = 0;
      } else {
        this.bustedTimer += dt;
        if (this.bustedTimer >= WANTED.bustedSeconds) return 'busted';
      }
    } else {
      this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
    }
    return 'chased';
  }
}
