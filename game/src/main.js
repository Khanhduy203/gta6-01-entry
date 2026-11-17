// Solmar City — the game itself: renderer, camera, the loop, and all the
// wiring between the systems. One job: run the game, from menu to bust.
import * as THREE from 'three';
import { City } from './city.js';
import { TrafficCar, PlayerCar, buildCarMesh } from './vehicles.js';
import { PedestrianCrowd, GangMember } from './pedestrians.js';
import { PoliceForce } from './police.js';
import { Player } from './player.js';
import { MissionManager } from './missions.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';
import {
  PLAYER, WANTED, COMBAT, TRAFFIC_CARS,
  clamp, rand, dist2D,
} from './config.js';

// ?shot=cover|drive|foot|city stages a scene for a screenshot and
// starts the game on its own, so a headless browser can capture it.
const shotMode = new URLSearchParams(location.search).get('shot');
const SPAWN = { x: 0, z: 40 };

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      62, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.camera.position.set(40, 26, 90);
    this._lights();

    this.city = new City(this.scene);
    this.input = new Input(this.canvas);
    this.sounds = new SoundBank();
    this.hud = new Hud();
    this.player = new Player(this.scene, this.city);
    this.playerCar = new PlayerCar(this.scene, this.city);
    this.police = new PoliceForce(this.scene);
    this.crowd = new PedestrianCrowd(this.scene, this.city);
    this.missions = new MissionManager(this.scene);
    this.traffic = [];
    this.parked = [];
    for (let i = 0; i < TRAFFIC_CARS; i++) {
      this.traffic.push(new TrafficCar(this.scene, this.city));
    }
    this._parkCars();
    this._wireMissions();

    // camera orbit state + the phase machine
    this.mode = 'menu'; // menu | playing | busted | wasted
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.camDist = 8;
    this.camDistances = [6, 8, 12];
    this.camDistIndex = 1;
    this.menuAngle = 0.6;
    this.gunfireAt = null;
    this.gunfireTimer = 0;
    this.lastPedHit = -10;
    this.saveTimer = 0;
    this.elapsed = 0;
    this.shotDrive = false;
    this.clock = new THREE.Clock();

    this._wireScreens();
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    if (shotMode) {
      this.start(false);
    } else {
      this._menuCamera(0);
    }
    this.renderer.setAnimationLoop(() => this._tick());
  }

  _lights() {
    const sun = new THREE.DirectionalLight(0xfff2d0, 2.6);
    sun.position.set(120, 180, 60);
    sun.castShadow = true;
    sun.shadow.camera.left = -260;
    sun.shadow.camera.right = 260;
    sun.shadow.camera.top = 260;
    sun.shadow.camera.bottom = -260;
    sun.shadow.camera.far = 600;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0xbfd8ff, 0.85));
    this.scene.add(new THREE.HemisphereLight(0x9cc8e8, 0x8a7a5c, 0.5));
  }

  // Static cars the player can steal: one near the spawn, the yellow
  // Comet GT for Vera's second job, and a few more around town.
  _parkCars() {
    const spots = [
      { x: 8, z: 34.5, heading: Math.PI / 2, color: 0xd93a3a },
      { x: 42.5, z: -35.5, heading: 0, color: 0xe8c33a },
      { x: -42, z: -35.5, heading: -Math.PI / 2, color: 0x3a6fd9 },
      { x: 120, z: 113.5, heading: Math.PI / 2, color: 0x3ad97a },
      { x: -120, z: -113.5, heading: -Math.PI / 2, color: 0xe8e8e8 },
      { x: 160, z: -42.5, heading: 0, color: 0x7a5ad9 },
    ];
    for (const s of spots) {
      const mesh = buildCarMesh(s.color, false);
      mesh.position.set(s.x, 0, s.z);
      mesh.rotation.y = s.heading;
      this.scene.add(mesh);
      this.parked.push({ x: s.x, z: s.z, heading: s.heading, mesh, color: s.color });
    }
  }

  _wireScreens() {
    this.startScreen = document.getElementById('start-screen');
    this.endScreen = document.getElementById('end-screen');
    this.endTitle = document.getElementById('end-title');
    this.endText = document.getElementById('end-text');
    this.hudRoot = document.getElementById('hud');
    const btnContinue = document.getElementById('btn-continue');
    if (!hasSave()) btnContinue.style.display = 'none';
    document.getElementById('btn-new').addEventListener('click', () => {
      this.sounds.unlock();
      this.start(false);
    });
    btnContinue.addEventListener('click', () => {
      this.sounds.unlock();
      this.start(true);
    });
    document.getElementById('btn-resume').addEventListener('click', () => {
      this.sounds.click();
      this._respawn();
    });
  }

  _wireMissions() {
    this.missions.onEvent = (event, data) => {
      if (event === 'start') {
        this.hud.setObjective(data.def.title, data.def.brief);
        this.hud.toast('NEW JOB: ' + data.def.title, 5000);
        this.sounds.click();
        this._maybeSpawnGang();
      } else if (event === 'step') {
        this.hud.toast('Next: ' + this.missions.objectiveText(), 4000);
        this.sounds.click();
        this._maybeSpawnGang();
      } else if (event === 'heat') {
        this.police.addStars(2);
        this.hud.toast('The heat is on — lose the cops!', 4000);
      } else if (event === 'pickup') {
        this.sounds.pickup();
        this.hud.toast('Drop collected (' + data.collected + '/3)', 2500);
      } else if (event === 'done') {
        this.player.money += data.def.reward;
        this.sounds.missionDone();
        this.hud.toast('JOB DONE — +$' + data.def.reward, 5000);
        this._clearGang();
        this._saveNow();
        const next = this.missions.currentDef;
        this.hud.setObjective(
          next ? next.title : 'Solmar City',
          next ? 'Press T for your next job: ' + next.title
            : 'Story complete — Solmar is yours. Free roam!');
      } else if (event === 'fail') {
        this.sounds.missionFail();
        this.hud.toast('JOB FAILED — ' + data.reason, 5000);
        this._clearGang();
      }
    };
  }

  // A combat step needs its rivals on the ground before the player arrives.
  _maybeSpawnGang() {
    if (!this.missions.active) return;
    const step = this.missions.active.def.steps[this.missions.active.step];
    if (step.type !== 'combat') return;
    for (let i = 0; i < (step.enemies || 3); i++) {
      const x = step.x + rand(-9, 9);
      const z = step.z + rand(-9, 9);
      this.missions.gang.push(new GangMember(this.scene, x, z));
    }
  }

  _clearGang() {
    for (const g of this.missions.gang) this.scene.remove(g.mesh);
    this.missions.gang = [];
  }

  start(continueSave) {
    if (continueSave) {
      const data = loadGame();
      if (data) this._restore(data);
    } else {
      clearSave();
    }
    this.startScreen.classList.add('hidden');
    this.endScreen.classList.add('hidden');
    this.hudRoot.classList.remove('hud-hidden');
    this.mode = 'playing';
    const next = this.missions.currentDef;
    this.hud.setObjective(
      next ? next.title : 'Solmar City',
      next ? 'Press T to start the next job: ' + next.title
        : 'Story complete — Solmar is yours. Free roam!');
    if (shotMode) this._stageShot();
    this._snapCamera();
  }

  _restore(data) {
    this.player.money = data.money;
    this.player.health = data.health;
    this.player.x = data.x;
    this.player.z = data.z;
    this.missions.index = data.missionIndex;
  }

  _saveNow() {
    saveGame({
      money: this.player.money,
      missionIndex: this.missions.index,
      health: this.player.health,
      x: this.player.x,
      z: this.player.z,
    });
  }

  // Put the world in the state a screenshot wants: a chase for the
  // cover, a fast drive, a quiet walk by the sea, or the whole city
  // from above.
  _stageShot() {
    if (shotMode === 'cover') {
      this.missions.startMission();
      const car = this.parked[0];
      this.player.enterCar(car, this.playerCar);
      this._stealCar(car);
      this.playerCar.speed = 20;
      this.police.addStars(2);
      this.shotDrive = true;
    } else if (shotMode === 'drive') {
      // a different car, a different road, a wider 3/4 camera than the cover
      const car = this.parked[2];
      this.player.enterCar(car, this.playerCar);
      this._stealCar(car);
      this.playerCar.speed = 24;
      this.police.addStars(1);
      this.camYaw = -Math.PI / 2 + 0.5;
      this.camPitch = 0.3;
      this.camDist = 11;
      this.shotDrive = true;
    } else if (shotMode === 'foot') {
      // on the sand at the boardwalk, facing the sea, camera behind
      this.player.x = 0;
      this.player.z = 208;
      this.player.heading = 0;
      this.camYaw = 0;
      this.camPitch = 0.22;
    } else if (shotMode === 'city') {
      this.player.x = 24;
      this.player.z = 24;
      this.hudRoot.classList.add('hud-hidden');
      this.camera.position.set(95, 135, 155);
      this.camera.lookAt(0, 0, 0);
    }
  }

  // Take a parked or traffic car out of the world once Leo has it.
  _stealCar(car) {
    const pi = this.parked.indexOf(car);
    if (pi !== -1) {
      this.scene.remove(car.mesh);
      this.parked.splice(pi, 1);
      return;
    }
    const ti = this.traffic.indexOf(car);
    if (ti !== -1) {
      this.scene.remove(car.mesh);
      this.traffic.splice(ti, 1);
    }
  }

  _end(kind) {
    const fine = Math.floor(this.player.money * WANTED.fineFraction);
    this.player.money -= fine;
    if (this.player.driving) this.player.exitCar();
    this.mode = kind; // 'busted' | 'wasted'
    this.sounds.busted();
    this.endTitle.textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
    this.endText.textContent = kind === 'busted'
      ? 'The Solmar PD dragged you in. Bail and fines cost you $' + fine + '.'
      : 'Leo went down. The hospital patched him up for $' + fine + '.';
    this.endScreen.classList.remove('hidden');
    this._saveNow();
  }

  _respawn() {
    this.endScreen.classList.add('hidden');
    this.player.health = PLAYER.maxHealth;
    this.player.x = SPAWN.x;
    this.player.z = SPAWN.z;
    this.player.y = 0;
    this.player.vx = 0;
    this.player.vz = 0;
    this.police.clear();
    this.missions.abort();
    this._clearGang();
    this.mode = 'playing';
    this._snapCamera();
    this._saveNow();
  }

  _enterExitCar() {
    if (this.player.driving) {
      // leave the car behind as a parked car Leo can steal again
      const x = this.playerCar.x, z = this.playerCar.z;
      const heading = this.playerCar.heading, color = this.playerCar.color;
      this.player.exitCar();
      const mesh = buildCarMesh(color, false);
      mesh.position.set(x, 0, z);
      mesh.rotation.y = heading;
      this.scene.add(mesh);
      this.parked.push({ x, z, heading, mesh, color });
      this.sounds.click();
      return;
    }
    const nearby = this.player.nearestCar(
      this.traffic.concat(this.parked), 4.5);
    if (!nearby) {
      this.hud.toast('No car close enough — walk up to one first.', 2500);
      return;
    }
    this.player.enterCar(nearby, this.playerCar);
    this._stealCar(nearby);
    this.police.addStars(1);
    this.hud.toast('Car stolen — the cops noticed!', 3000);
    this.sounds.horn();
  }

  // A rival opened fire: the shot usually lands, and it hurts.
  _enemyShot(enemy) {
    this.sounds.enemyShot();
    if (Math.random() < 0.55) {
      const dead = this.player.damage(COMBAT.enemyDamage);
      if (dead && this.mode === 'playing') this._end('wasted');
    }
  }

  // Leo's pistol found its mark.
  _shotHit(enemy) {
    const killed = enemy.damage(COMBAT.pistolDamage);
    if (killed) {
      this.player.money += 50;
      this.hud.toast('Rival down — +$50', 2000);
    }
  }

  _tryShoot() {
    if (this.player.driving || this.mode !== 'playing') return;
    const freshBurst = this.gunfireTimer <= 0;
    const hit = this.player.shoot(this.camera, this.missions.gang,
      (enemy) => this._shotHit(enemy));
    if (!hit) return; // still cooling down from the last shot
    this.sounds.gunshot();
    this.gunfireAt = { x: this.player.x, z: this.player.z };
    this.gunfireTimer = 3;
    if (freshBurst) this.police.addStars(1);
  }

  // The menu drifts slowly around the tower while the player decides.
  _menuCamera(dt) {
    this.menuAngle += dt * 0.05;
    const r = 120;
    this.camera.position.set(
      Math.sin(this.menuAngle) * r, 55, Math.cos(this.menuAngle) * r);
    this.camera.lookAt(0, 12, 0);
  }

  _followPoint() {
    if (this.player.driving) {
      return new THREE.Vector3(this.playerCar.x, 1.6, this.playerCar.z);
    }
    return new THREE.Vector3(this.player.x, 1.7, this.player.z);
  }

  _snapCamera() {
    if (shotMode === 'city') return;
    const target = this._followPoint();
    const cx = target.x - Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    const cy = target.y + Math.sin(this.camPitch) * this.camDist;
    const cz = target.z - Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    this.camera.position.set(cx, Math.max(cy, 1.2), cz);
    this.camera.lookAt(this._lookPoint(target));
  }

  // On foot the camera aims a touch above the player's head, so the
  // crosshair floats ahead of Leo instead of sitting on his cap.
  _lookPoint(target) {
    if (this.player.driving) return target;
    return new THREE.Vector3(target.x, target.y + 0.55, target.z);
  }

  _updateCamera(dt) {
    if (shotMode === 'city') {
      this.camera.lookAt(0, 0, 0);
      return;
    }
    // mouse drag orbits; the yaw eases behind the player's heading
    this.camYaw += this.input.yawDelta;
    this.camPitch = clamp(this.camPitch + this.input.pitchDelta, 0.05, 1.1);
    const target = this._followPoint();
    const cx = target.x - Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    const cy = target.y + Math.sin(this.camPitch) * this.camDist;
    const cz = target.z - Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    const desired = new THREE.Vector3(cx, Math.max(cy, 1.2), cz);
    const blend = 1 - Math.pow(0.001, dt);
    this.camera.position.lerp(desired, blend);
    this.camera.lookAt(this._lookPoint(target));
  }

  _tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;
    if (this.mode === 'menu') {
      this._menuCamera(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.mode === 'playing') this._update(dt);
    this._updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  _update(dt) {
    const input = this.input;
    const p = this.player;

    if (input.wasPressed('KeyE')) this._enterExitCar();
    if (input.wasPressed('KeyM')) {
      const muted = this.sounds.toggleMute();
      this.hud.toast(muted ? 'Sound off' : 'Sound on', 1500);
    }
    if (input.wasPressed('KeyT')) {
      if (!this.missions.active) {
        if (!this.missions.startMission()) {
          this.hud.toast('No more jobs — the story is complete.', 3000);
        }
      } else {
        this.hud.toast(this.missions.objectiveText(), 3000);
      }
    }
    if (input.wasPressed('KeyC')) {
      this.camDistIndex = (this.camDistIndex + 1) % this.camDistances.length;
      this.camDist = this.camDistances[this.camDistIndex];
    }
    if (input.shoot) this._tryShoot();

    // the car moves itself when a screenshot is being staged
    const driveInput = this.shotDrive
      ? { forward: true, back: false, left: false, right: false, handbrake: false }
      : input;
    if (p.driving) {
      this.playerCar.update(dt, driveInput, this.traffic,
        (strength) => this.sounds.crash(strength));
    }
    p.update(dt, input, this.camYaw);

    for (const t of this.traffic) t.update(dt, this.traffic);
    if (this.gunfireTimer > 0) this.gunfireTimer -= dt;
    else this.gunfireAt = null;
    this.crowd.update(dt, p.pos, this.gunfireAt);

    // a speeding car that clips a pedestrian is a crime, throttled
    if (p.driving && Math.abs(this.playerCar.speed) > 5) {
      if (this.crowd.hitByCar(this.playerCar.x, this.playerCar.z)
        && this.elapsed - this.lastPedHit > 3) {
        this.lastPedHit = this.elapsed;
        this.police.addStars(1);
        this.sounds.crash(0.5);
        this.hud.toast('You hit a pedestrian!', 3000);
      }
    }

    for (const g of this.missions.gang) {
      g.update(dt, p.pos, (enemy) => this._enemyShot(enemy));
    }

    const speed = p.driving ? Math.abs(this.playerCar.speed) : 0;
    const status = this.police.update(dt, p.pos, p.driving, speed);
    if (status === 'busted' && this.mode === 'playing') {
      this._end('busted');
      return;
    }

    const outcome = this.missions.update(dt, p.pos, p.driving, this.police.stars);
    if (outcome === 'done' || outcome === 'failed') {
      this.hud.setObjective(
        this.missions.currentDef ? this.missions.currentDef.title : 'Solmar City',
        this.missions.objectiveText());
    } else if (this.missions.active) {
      this.hud.setObjective(this.missions.active.def.title, this.missions.objectiveText());
    }

    this.sounds.setEngine(p.driving ? speed / 34 : 0, p.driving);
    this.sounds.setSiren(this.police.stars);

    // quiet autosave while playing
    this.saveTimer += dt;
    if (this.saveTimer > 25) {
      this.saveTimer = 0;
      this._saveNow();
    }

    this._updateHud();
  }

  _updateHud() {
    const p = this.player;
    const speedKmh = p.driving ? Math.abs(this.playerCar.speed) * 3.6 : 0;
    this.hud.update({
      health: p.health,
      money: p.money,
      stars: this.police.stars,
      speedKmh,
      driving: p.driving,
      bustedTimer: this.police.bustedTimer,
      armed: p.armed,
    });
    const policeDots = this.police.cars.filter((c) => c.active)
      .concat(this.police.officers.filter((o) => o.active));
    this.hud.drawMinimap({
      waypoint: this.missions.waypoint(),
      traffic: this.traffic,
      gang: this.missions.gang,
      police: policeDots,
      player: p.pos,
      heading: p.driving ? this.playerCar.heading : p.heading,
    });
  }
}

new Game();
