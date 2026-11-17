// Solmar City — the player: Leo Marín, on foot and behind the wheel.
// One job: move the player, get in and out of cars, and shoot the pistol.
import * as THREE from 'three';
import {
  PLAYER, CAR, COMBAT, clamp, angleLerp, dist2D,
} from './config.js';
import { buildPersonMesh } from './pedestrians.js';

export class Player {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.mesh = buildPersonMesh(0x3a6fd9, 0xe8b88a);
    // Leo's look: blue shirt, dark cap, white sneakers implied by the mesh
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.12, 8),
      new THREE.MeshLambertMaterial({ color: 0xd9c33a }));
    cap.position.y = 1.92;
    this.mesh.add(cap);
    scene.add(this.mesh);
    this.x = 0; this.z = 40;
    this.vx = 0; this.vz = 0;
    this.y = 0; this.vy = 0;
    this.heading = Math.PI;
    this.health = PLAYER.maxHealth;
    this.money = PLAYER.startMoney;
    this.driving = false;
    this.car = null;
    this.fireTimer = 0;
    this.armed = true;
    // tracer line for gunfire, reused every shot
    const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
    const tracerGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(), new THREE.Vector3()]);
    this.tracer = new THREE.Line(tracerGeo, tracerMat);
    this.tracer.visible = false;
    this.tracerTimer = 0;
    scene.add(this.tracer);
  }

  get pos() { return { x: this.x, z: this.z }; }

  update(dt, input, cameraYaw) {
    this.fireTimer = Math.max(0, this.fireTimer - dt);
    if (this.tracerTimer > 0) {
      this.tracerTimer -= dt;
      if (this.tracerTimer <= 0) this.tracer.visible = false;
    }
    if (this.driving) {
      // the car moves the player; just ride along
      this.x = this.car.x;
      this.z = this.car.z;
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    const sprint = input.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    // movement relative to the camera yaw
    let mx = 0, mz = 0;
    if (input.forward) { mx += Math.sin(cameraYaw); mz += Math.cos(cameraYaw); }
    if (input.back) { mx -= Math.sin(cameraYaw); mz -= Math.cos(cameraYaw); }
    if (input.left) { mx += Math.sin(cameraYaw - Math.PI / 2); mz += Math.cos(cameraYaw - Math.PI / 2); }
    if (input.right) { mx += Math.sin(cameraYaw + Math.PI / 2); mz += Math.cos(cameraYaw + Math.PI / 2); }
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len; mz /= len;
      this.vx += mx * PLAYER.accel * dt;
      this.vz += mz * PLAYER.accel * dt;
      this.heading = angleLerp(this.heading, Math.atan2(mx, mz), 1 - Math.pow(0.0001, dt));
    }
    // friction
    const sp = Math.hypot(this.vx, this.vz);
    if (sp > 0) {
      const ns = Math.max(0, sp - PLAYER.friction * dt);
      this.vx = (this.vx / sp) * ns;
      this.vz = (this.vz / sp) * ns;
    }
    // cap speed
    const sp2 = Math.hypot(this.vx, this.vz);
    if (sp2 > sprint) {
      this.vx = (this.vx / sp2) * sprint;
      this.vz = (this.vz / sp2) * sprint;
    }
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.x = clamp(this.x, -202, 202);
    this.z = clamp(this.z, -202, 236);
    // jump + gravity
    if (input.jump && this.y === 0) this.vy = PLAYER.jumpSpeed;
    this.vy -= PLAYER.gravity * dt;
    this.y += this.vy * dt;
    if (this.y < 0) { this.y = 0; this.vy = 0; }
    this.city.resolveCircle(this, PLAYER.radius);
    // animate: bob and lean into the run
    const speedRatio = sp2 / PLAYER.sprintSpeed;
    const bob = Math.sin(performance.now() / 110) * 0.06 * speedRatio;
    this.mesh.position.set(this.x, this.y + Math.abs(bob), this.z);
    this.mesh.rotation.y = this.heading;
    const swing = Math.sin(performance.now() / 110) * 0.5 * speedRatio;
    this.mesh.userData.legs[0].rotation.x = swing;
    this.mesh.userData.legs[1].rotation.x = -swing;
  }

  // Find the closest car the player could steal (traffic or parked).
  nearestCar(cars, maxDist) {
    let best = null, bestD = maxDist;
    for (const c of cars) {
      const d = dist2D(this.x, this.z, c.x, c.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  enterCar(car, playerCar) {
    this.driving = true;
    this.car = playerCar;
    playerCar.enter(car.x, car.z, car.heading, car.mesh.userData.color || 0xd93a3a);
    return true;
  }

  exitCar() {
    if (!this.car) return;
    this.driving = false;
    // step out to the side of the car
    const side = this.car.heading + Math.PI / 2;
    this.x = this.car.x + Math.sin(side) * 2.4;
    this.z = this.car.z + Math.cos(side) * 2.4;
    this.vx = 0; this.vz = 0;
    this.car.exit();
    this.car = null;
  }

  // Hitscan pistol: ray from the camera through the screen centre.
  // Returns the point hit (for the tracer) and calls onHit(target) for
  // whatever enemy the ray struck first.
  shoot(camera, targets, onHitEnemy) {
    if (this.fireTimer > 0 || this.driving) return null;
    this.fireTimer = COMBAT.fireInterval;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    ray.far = COMBAT.pistolRange;
    const hits = [];
    for (const t of targets) {
      if (!t.alive) continue;
      const toTarget = new THREE.Vector3(t.x - this.x, 1.2 - 1.5, t.z - this.z);
      const dist = toTarget.length();
      const dir = ray.ray.direction;
      const along = toTarget.x * dir.x + toTarget.y * dir.y + toTarget.z * dir.z;
      if (along < 0 || along > COMBAT.pistolRange) continue;
      const perp = Math.sqrt(Math.max(0, dist * dist - along * along));
      if (perp < 1.1) hits.push({ target: t, along });
    }
    hits.sort((a, b) => a.along - b.along);
    const muzzle = new THREE.Vector3(this.x, 1.5, this.z);
    let end;
    if (hits.length) {
      const t = hits[0].target;
      end = new THREE.Vector3(t.x, 1.2, t.z);
      if (onHitEnemy) onHitEnemy(t);
    } else {
      end = ray.ray.at(COMBAT.pistolRange, new THREE.Vector3());
      // stop the tracer at the first building in the way
      const step = new THREE.Vector3().copy(ray.ray.direction).multiplyScalar(0.5);
      const probe = { x: this.x, z: this.z };
      for (let d = 0; d < COMBAT.pistolRange; d += 0.5) {
        probe.x = this.x + ray.ray.direction.x * d;
        probe.z = this.z + ray.ray.direction.z * d;
        const before = { x: probe.x, z: probe.z };
        if (this.city.resolveCircle(before, 0.1)) {
          end = new THREE.Vector3(probe.x, 1.5, probe.z);
          break;
        }
      }
    }
    const pts = this.tracer.geometry.attributes.position;
    pts.setXYZ(0, muzzle.x, muzzle.y, muzzle.z);
    pts.setXYZ(1, end.x, end.y, end.z);
    pts.needsUpdate = true;
    this.tracer.visible = true;
    this.tracerTimer = 0.07;
    return end;
  }

  damage(amount) {
    this.health -= amount;
    return this.health <= 0;
  }

  heal(amount) { this.health = Math.min(PLAYER.maxHealth, this.health + amount); }
}
