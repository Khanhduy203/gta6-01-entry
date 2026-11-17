// Solmar City — pedestrians: people walking the sidewalks, plus the rival
// gang members missions spawn. One job: everyone on foot who is not the player.
import * as THREE from 'three';
import {
  COMBAT, ROAD_CENTERS, HALF, rand, pick, clamp, dist2D,
} from './config.js';

const SHIRT_COLORS = [0xe8e8e8, 0x3a6fd9, 0xd93a6f, 0x3ad97a, 0xe8c33a, 0x7a5ad9, 0xd97a3a, 0x9ad9e8];

// A simple person: cylinder body, sphere head, swinging legs implied by bob.
export function buildPersonMesh(shirtColor, skinColor) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.4, 1.05, 8),
    new THREE.MeshLambertMaterial({ color: shirtColor }));
  body.position.y = 0.95;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshLambertMaterial({ color: skinColor || 0xe8b88a }));
  head.position.y = 1.72;
  head.castShadow = true;
  g.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), legMat);
  legL.position.set(-0.14, 0.35, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.14;
  g.add(legR);
  g.userData.legs = [legL, legR];
  return g;
}

class Walker {
  constructor(scene, city) {
    this.scene = scene;
    this.mesh = buildPersonMesh(pick(SHIRT_COLORS));
    scene.add(this.mesh);
    this.speed = rand(1.2, 2.2);
    this.fleeing = false;
    this.fleeTimer = 0;
    this._pickSidewalk();
  }

  _pickSidewalk() {
    // Walk along a sidewalk: beside a road, offset from its centreline.
    const horizontal = Math.random() < 0.5;
    const road = pick(ROAD_CENTERS);
    const along = rand(-190, 190);
    const side = Math.random() < 0.5 ? -1 : 1;
    if (horizontal) {
      this.x = along; this.z = road + side * 9.5;
      this.dir = Math.random() < 0.5 ? 1 : -1;
      this.axis = 'x';
    } else {
      this.x = road + side * 9.5; this.z = along;
      this.dir = Math.random() < 0.5 ? 1 : -1;
      this.axis = 'z';
    }
  }

  update(dt, playerPos, gunfireAt) {
    // Flee from nearby gunfire for a few seconds.
    if (gunfireAt && dist2D(this.x, this.z, gunfireAt.x, gunfireAt.z) < 26) {
      this.fleeing = true; this.fleeTimer = 3;
    }
    if (this.fleeTimer > 0) this.fleeTimer -= dt;
    else this.fleeing = false;
    const speed = this.speed * (this.fleeing ? 2.6 : 1);
    if (this.axis === 'x') {
      this.x += this.dir * speed * dt;
      if (this.x > 195 || this.x < -195) this.dir *= -1;
    } else {
      this.z += this.dir * speed * dt;
      if (this.z > 195 || this.z < -195) this.dir *= -1;
    }
    // face the walking direction, bob while walking
    const targetYaw = this.axis === 'x'
      ? (this.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
      : (this.dir > 0 ? 0 : Math.PI);
    this.mesh.rotation.y = targetYaw;
    const bob = Math.sin(performance.now() / 130 + this.x) * 0.06;
    this.mesh.position.set(this.x, Math.abs(bob), this.z);
    const swing = Math.sin(performance.now() / 130 + this.x) * 0.4;
    this.mesh.userData.legs[0].rotation.x = swing;
    this.mesh.userData.legs[1].rotation.x = -swing;
  }

  remove() {
    this.scene.remove(this.mesh);
  }
}

// A rival gang member: stands his ground and shoots at the player.
export class GangMember {
  constructor(scene, x, z) {
    this.scene = scene;
    this.mesh = buildPersonMesh(0x8a1a1a, 0xd9a06a);
    // gang colours: dark red shirt, black cap
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.12, 8),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    cap.position.y = 1.92;
    this.mesh.add(cap);
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.x = x; this.z = z;
    this.health = COMBAT.enemyHealth;
    this.fireTimer = rand(0.5, 1.5);
    this.alive = true;
  }

  update(dt, playerPos, onShoot) {
    if (!this.alive) return;
    const d = dist2D(this.x, this.z, playerPos.x, playerPos.z);
    // face the player
    this.mesh.rotation.y = Math.atan2(playerPos.x - this.x, playerPos.z - this.z);
    this.fireTimer -= dt;
    if (d < COMBAT.enemyRange && this.fireTimer <= 0) {
      this.fireTimer = COMBAT.enemyFireInterval * rand(0.85, 1.3);
      if (onShoot) onShoot(this);
    }
  }

  damage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.alive = false;
      // fall over
      this.mesh.rotation.x = -Math.PI / 2;
      this.mesh.position.y = 0.3;
      return true;
    }
    return false;
  }
}

export class PedestrianCrowd {
  constructor(scene, city) {
    this.scene = scene;
    this.walkers = [];
    for (let i = 0; i < 22; i++) this.walkers.push(new Walker(scene, city));
  }

  update(dt, playerPos, gunfireAt) {
    for (const w of this.walkers) w.update(dt, playerPos, gunfireAt);
  }

  // A walker hit by a car: knock them down and respawn them elsewhere.
  hitByCar(x, z) {
    let nearest = null, best = 2.8;
    for (const w of this.walkers) {
      const d = dist2D(w.x, w.z, x, z);
      if (d < best) { best = d; nearest = w; }
    }
    if (!nearest) return false;
    nearest.mesh.rotation.x = -Math.PI / 2;
    nearest.mesh.position.y = 0.3;
    setTimeout(() => {
      nearest.mesh.rotation.x = 0;
      nearest._pickSidewalk();
    }, 4000);
    return true;
  }
}
