// Solmar City — the world: streets, towers, parks, beach and sea.
// One job: raise the static city, keep its collision boxes, and answer
// "is this point on a road?" for the rest of the game.
import * as THREE from 'three';
import {
  BLOCK, ROAD, HALF, ROAD_CENTERS, BLOCK_CENTERS,
  BEACH_Z, OCEAN_Z, mulberry32,
} from './config.js';

// Sun-bleached stucco tones for the facades, and flat roof tones.
const WALL_TONES = [
  0xf5e6c8, 0xeab98c, 0xa8d0c0, 0xeda07e, 0xdccfae,
  0xf2dd9e, 0xcbb8dd, 0xaaccee, 0xecc9c9, 0xc49e78,
];
const ROOF_TONES = [0x8a6a52, 0x6a7a8a, 0x9a8a6a, 0x7a5a5a, 0x5a6a7a];

// One layout seed: the same city on every visit.
const LAYOUT_SEED = 90210;

// A facade with lit and dark windows, drawn on a canvas and wrapped
// around a building box. Each building gets its own tint + window draw.
function paintFacade(tone, rng) {
  const c = document.createElement('canvas');
  c.width = 96; c.height = 192;
  const g = c.getContext('2d');
  g.fillStyle = '#' + tone.toString(16).padStart(6, '0');
  g.fillRect(0, 0, 96, 192);
  // a darker plinth at the base and a trim line under the roof
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(0, 176, 96, 16);
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillRect(0, 0, 96, 3);
  // windows: 3 across, 6 up, some of them lit warm
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 3; col++) {
      const lit = rng() < 0.3;
      g.fillStyle = lit ? '#ffd98a' : '#274050';
      g.fillRect(10 + col * 28, 14 + row * 28, 16, 20);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(10 + col * 28, 14 + row * 28, 16, 4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Asphalt with a dashed centre line; repeats along the road's length.
function paintRoad() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#33373d';
  g.fillRect(0, 0, 64, 128);
  // speckle the asphalt so it is not a flat slab
  for (let i = 0; i < 260; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.14)';
    g.fillRect(Math.floor(Math.random() * 64), Math.floor(Math.random() * 128), 2, 2);
  }
  // edge lines + one dashed centre line
  g.fillStyle = '#e8e8e8';
  g.fillRect(3, 0, 2, 128);
  g.fillRect(59, 0, 2, 128);
  g.fillStyle = '#ffd94d';
  g.fillRect(30, 10, 4, 44);
  g.fillRect(30, 74, 4, 44);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// The same asphalt with the dashes turned sideways, for roads that run
// along x: the dash line follows the road's length, not its width.
function paintRoadH() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#33373d';
  g.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.14)';
    g.fillRect(Math.floor(Math.random() * 128), Math.floor(Math.random() * 64), 2, 2);
  }
  g.fillStyle = '#e8e8e8';
  g.fillRect(0, 3, 128, 2);
  g.fillRect(0, 59, 128, 2);
  g.fillStyle = '#ffd94d';
  g.fillRect(10, 30, 44, 4);
  g.fillRect(74, 30, 44, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class City {
  constructor(scene) {
    this.scene = scene;
    this.solids = []; // collision boxes: {x0, z0, x1, z1}
    this.rng = mulberry32(LAYOUT_SEED);
    this.roadTex = paintRoad();
    this.roadTexH = paintRoadH();
    this.build();
  }

  build() {
    this.layGround();
    this.paveRoads();
    this.raiseDistrict();
    this.raiseTower();
    this.growParks();
    this.lineBeach();
    this.setLamps();
    this.setSky();
  }

  // A flat box helper: one mesh, one material, shadows on, added to the scene.
  _box(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }

  _mat(color, extra) {
    return new THREE.MeshLambertMaterial(Object.assign({ color }, extra || {}));
  }

  layGround() {
    // grass under everything, then sand, then the sea to the south
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(480, 480),
      this._mat(0x5f8f46));
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, 0, 0);
    grass.receiveShadow = true;
    this.scene.add(grass);
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(480, OCEAN_Z - BEACH_Z),
      this._mat(0xe8d49a));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.02, (BEACH_Z + OCEAN_Z) / 2);
    sand.receiveShadow = true;
    this.scene.add(sand);
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(480, 200),
      new THREE.MeshLambertMaterial({ color: 0x2a7ab8, transparent: true, opacity: 0.92 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, 0.05, OCEAN_Z + 100);
    this.scene.add(sea);
  }

  paveRoads() {
    const span = HALF * 2 + 36;
    const repeats = Math.round(span / 16);
    for (const c of ROAD_CENTERS) {
      // road along z at x = c
      const tz = this.roadTex.clone();
      tz.needsUpdate = true;
      tz.repeat.set(1, repeats);
      const rz = new THREE.Mesh(
        new THREE.PlaneGeometry(ROAD, span),
        new THREE.MeshLambertMaterial({ map: tz }));
      rz.rotation.x = -Math.PI / 2;
      rz.position.set(c, 0.01, 0);
      rz.receiveShadow = true;
      this.scene.add(rz);
      // road along x at z = c: same asphalt, dashes drawn sideways
      const th = this.roadTexH.clone();
      th.needsUpdate = true;
      th.repeat.set(repeats, 1);
      const rx = new THREE.Mesh(
        new THREE.PlaneGeometry(span, ROAD),
        new THREE.MeshLambertMaterial({ map: th }));
      rx.rotation.x = -Math.PI / 2;
      rx.position.set(0, 0.01, c);
      rx.receiveShadow = true;
      this.scene.add(rx);
      // pale sidewalks flanking both roads
      const walk = this._mat(0xb8b0a0);
      for (const side of [-1, 1]) {
        const wz = new THREE.Mesh(new THREE.PlaneGeometry(5, span), walk);
        wz.rotation.x = -Math.PI / 2;
        wz.position.set(c + side * (ROAD / 2 + 2.5), 0.015, 0);
        wz.receiveShadow = true;
        this.scene.add(wz);
        const wx = new THREE.Mesh(new THREE.PlaneGeometry(span, 5), walk);
        wx.rotation.x = -Math.PI / 2;
        wx.position.set(0, 0.015, c + side * (ROAD / 2 + 2.5));
        wx.receiveShadow = true;
        this.scene.add(wx);
      }
    }
  }

  raiseDistrict() {
    // Every block gets one or two buildings, except the parks and the
    // tower block at the centre. Seeded, so the skyline never changes.
    const rng = this.rng;
    for (const bx of BLOCK_CENTERS) {
      for (const bz of BLOCK_CENTERS) {
        if ((bx === -78 && bz === -78) || (bx === 78 && bz === 78)) continue;
        if (bx === 0 && bz === 0) continue;
        const twin = rng() < 0.55;
        if (twin) {
          const split = rng() < 0.5 ? 'x' : 'z';
          const off = BLOCK / 4;
          if (split === 'x') {
            this._tower2(bx - off, bz, rng);
            this._tower2(bx + off, bz, rng);
          } else {
            this._tower2(bx, bz - off, rng);
            this._tower2(bx, bz + off, rng);
          }
        } else {
          this._tower2(bx, bz, rng);
        }
      }
    }
  }

  // One building: a textured box with a flat roof slab and a small
  // rooftop box, plus its collision box.
  _tower2(cx, cz, rng) {
    const w = 18 + rng() * 14;
    const d = 18 + rng() * 14;
    const h = 8 + rng() * rng() * 24;
    const tone = WALL_TONES[Math.floor(rng() * WALL_TONES.length)];
    const walls = new THREE.MeshLambertMaterial({ map: paintFacade(tone, rng) });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), walls);
    body.position.set(cx, h / 2, cz);
    body.castShadow = true;
    body.receiveShadow = true;
    this.scene.add(body);
    const roof = ROOF_TONES[Math.floor(rng() * ROOF_TONES.length)];
    this._box(w + 0.6, 0.5, d + 0.6, this._mat(roof), cx, h + 0.25, cz);
    // a rooftop plant box on the taller buildings
    if (h > 16) {
      this._box(3 + rng() * 2, 1.6, 3 + rng() * 2, this._mat(0x9a9a9a),
        cx + (rng() - 0.5) * (w - 6), h + 1.3, cz + (rng() - 0.5) * (d - 6));
    }
    this.solids.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2 });
  }

  raiseTower() {
    // The Solmar Spire: the city's landmark, dead centre, tall enough
    // to be seen from the beach. Glassy blue, with a beacon on top.
    const glass = new THREE.MeshLambertMaterial({ color: 0x7fb8c9 });
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(26, 68, 26), glass);
    shaft.position.set(0, 34, 0);
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    this.scene.add(shaft);
    // horizontal floor bands so the shaft reads as storeys
    const bandMat = this._mat(0x5a90a8);
    for (let y = 8; y < 68; y += 12) {
      this._box(26.6, 0.7, 26.6, bandMat, 0, y, 0);
    }
    this._box(16, 9, 16, this._mat(0x4a7088), 0, 72.5, 0);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.4, 12, 6),
      this._mat(0x333333));
    mast.position.set(0, 82, 0);
    this.scene.add(mast);
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff4040 }));
    beacon.position.set(0, 88.5, 0);
    this.scene.add(beacon);
    // a paved plaza ring around the base
    const plaza = new THREE.Mesh(
      new THREE.PlaneGeometry(44, 44), this._mat(0xc8bfa8));
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(0, 0.02, 0);
    plaza.receiveShadow = true;
    this.scene.add(plaza);
    this.solids.push({ x0: -13, z0: -13, x1: 13, z1: 13 });
  }

  growParks() {
    for (const [bx, bz] of [[-78, -78], [78, 78]]) {
      this._onePark(bx, bz);
    }
  }

  _onePark(bx, bz) {
    const rng = this.rng;
    // a lighter lawn than the surrounding grass
    const lawn = new THREE.Mesh(
      new THREE.PlaneGeometry(BLOCK, BLOCK), this._mat(0x7ab85a));
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(bx, 0.02, bz);
    lawn.receiveShadow = true;
    this.scene.add(lawn);
    // two crossing paths
    const pathMat = this._mat(0xd8cfae);
    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK, 6), pathMat);
    p1.rotation.x = -Math.PI / 2;
    p1.position.set(bx, 0.03, bz);
    this.scene.add(p1);
    const p2 = new THREE.Mesh(new THREE.PlaneGeometry(6, BLOCK), pathMat);
    p2.rotation.x = -Math.PI / 2;
    p2.position.set(bx, 0.03, bz);
    this.scene.add(p2);
    // a round pond, off-centre
    const pond = new THREE.Mesh(
      new THREE.CircleGeometry(9, 20),
      new THREE.MeshLambertMaterial({ color: 0x3a9ad9 }));
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(bx + 14, 0.04, bz - 12);
    this.scene.add(pond);
    // trees scattered over the lawn
    for (let i = 0; i < 12; i++) {
      const x = bx + (rng() - 0.5) * (BLOCK - 10);
      const z = bz + (rng() - 0.5) * (BLOCK - 10);
      if (Math.abs(x - (bx + 14)) < 11 && Math.abs(z - (bz - 12)) < 11) continue;
      this._tree(x, z, rng);
    }
    // benches along the paths
    for (const [ox, oz, ry] of [[-12, 4, 0], [12, -4, Math.PI], [4, 12, Math.PI / 2], [-4, -12, -Math.PI / 2]]) {
      const bench = this._box(3, 0.5, 1, this._mat(0x8a6a3a), bx + ox, 0.45, bz + oz);
      bench.rotation.y = ry;
      this._box(0.3, 0.45, 0.9, this._mat(0x555555), bx + ox - 1.2, 0.22, bz + oz);
      this._box(0.3, 0.45, 0.9, this._mat(0x555555), bx + ox + 1.2, 0.22, bz + oz);
    }
  }

  _tree(x, z, rng) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.35, 2.6, 6),
      this._mat(0x6a4a2a));
    trunk.position.set(x, 1.3, z);
    trunk.castShadow = true;
    this.scene.add(trunk);
    const leafMat = this._mat(rng() < 0.5 ? 0x3a7a2a : 0x4a8a34);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(2 + rng() * 1.2, 8, 6), leafMat);
    crown.position.set(x, 3.6 + rng(), z);
    crown.scale.y = 0.85;
    crown.castShadow = true;
    this.scene.add(crown);
  }

  lineBeach() {
    // A double row of palms along the sand, plus a wooden boardwalk
    // plank line where the city meets the beach.
    const rng = this.rng;
    const walk = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 4), this._mat(0xa8845a));
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(0, 0.03, BEACH_Z - 2);
    walk.receiveShadow = true;
    this.scene.add(walk);
    for (let x = -196; x <= 196; x += 17) {
      this._palm(x + (rng() - 0.5) * 6, BEACH_Z + 6 + rng() * 4, rng);
      if (rng() < 0.6) this._palm(x + (rng() - 0.5) * 8, BEACH_Z + 20 + rng() * 6, rng);
    }
    // a few palms on the plaza too
    for (const [x, z] of [[-24, -24], [24, -24], [-24, 24], [24, 24]]) {
      this._palm(x, z, rng);
    }
  }

  _palm(x, z, rng) {
    const lean = (rng() - 0.5) * 0.35;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.34, 6.5, 6),
      this._mat(0x7a5a34));
    trunk.position.set(x, 3.2, z);
    trunk.rotation.z = lean;
    trunk.castShadow = true;
    this.scene.add(trunk);
    const topX = x - Math.sin(lean) * 3.2;
    const topY = 6.4;
    const frondMat = this._mat(0x2e8a3e);
    // Each frond hangs from its own yawed pivot, so the droop tilts
    // around the frond's own axis instead of the world's.
    for (let i = 0; i < 6; i++) {
      const pivot = new THREE.Group();
      pivot.position.set(topX, topY, z);
      pivot.rotation.y = (i / 6) * Math.PI * 2;
      const frond = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 3.4), frondMat);
      frond.position.set(0, 0, 1.5);
      frond.rotation.x = 0.55; // tip arcs down, palm-style
      frond.castShadow = true;
      pivot.add(frond);
      this.scene.add(pivot);
    }
    // a couple of coconuts
    const nutMat = this._mat(0x5a3a1a);
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 5), nutMat);
    nut.position.set(topX + 0.4, topY - 0.4, z + 0.3);
    this.scene.add(nut);
  }

  setLamps() {
    // One street lamp at every intersection corner, with a warm head.
    const poleMat = this._mat(0x2a2a2a);
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (const cx of ROAD_CENTERS) {
      for (const cz of ROAD_CENTERS) {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.09, 0.13, 6, 6), poleMat);
        pole.position.set(cx + 9, 3, cz + 9);
        this.scene.add(pole);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), poleMat);
        arm.position.set(cx + 8.2, 5.9, cz + 9);
        this.scene.add(arm);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), headMat);
        head.position.set(cx + 7.5, 5.8, cz + 9);
        this.scene.add(head);
      }
    }
  }

  setSky() {
    // A bright coastal sky, haze at the horizon, and a few slow clouds.
    this.scene.background = new THREE.Color(0x8ec9e8);
    this.scene.fog = new THREE.Fog(0xa8d0e8, 190, 680);
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.88 });
    const rng = this.rng;
    for (let i = 0; i < 10; i++) {
      const cloud = new THREE.Group();
      const puffs = 3 + Math.floor(rng() * 3);
      for (let p = 0; p < puffs; p++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(4 + rng() * 5, 8, 6), cloudMat);
        s.position.set((rng() - 0.5) * 14, (rng() - 0.5) * 2, (rng() - 0.5) * 6);
        s.scale.y = 0.45;
        cloud.add(s);
      }
      cloud.position.set((rng() - 0.5) * 420, 68 + rng() * 34, (rng() - 0.5) * 420);
      this.scene.add(cloud);
    }
  }

  // Push a circle (a walker, a car, a bullet probe) out of every solid
  // it overlaps. Returns true when anything was pushed — the caller
  // treats that as a collision.
  resolveCircle(pos, radius) {
    let hit = false;
    for (const s of this.solids) {
      const cx = Math.max(s.x0, Math.min(pos.x, s.x1));
      const cz = Math.max(s.z0, Math.min(pos.z, s.z1));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      hit = true;
      if (d2 > 1e-8) {
        // outside the box: push along the line from the closest point
        const d = Math.sqrt(d2);
        const push = (radius - d) / d;
        pos.x += dx * push;
        pos.z += dz * push;
      } else {
        // centre inside the box: escape along the smallest overlap
        const left = pos.x - s.x0 + radius;
        const right = s.x1 - pos.x + radius;
        const top = pos.z - s.z0 + radius;
        const bottom = s.z1 - pos.z + radius;
        const m = Math.min(left, right, top, bottom);
        if (m === left) pos.x = s.x0 - radius;
        else if (m === right) pos.x = s.x1 + radius;
        else if (m === top) pos.z = s.z0 - radius;
        else pos.z = s.z1 + radius;
      }
    }
    return hit;
  }

  // True when the point sits on asphalt: within half a road of any
  // road centreline, on either axis.
  onRoad(x, z) {
    const half = ROAD / 2 + 1;
    for (const c of ROAD_CENTERS) {
      if (Math.abs(x - c) <= half || Math.abs(z - c) <= half) return true;
    }
    return false;
  }
}
