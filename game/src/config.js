// Solmar City — shared tuning constants and small helpers.
// One job: hold every number the other modules agree on, plus the math
// helpers they all use. Nothing here touches the scene or the DOM.

// ---- city layout ---------------------------------------------------------
export const BLOCK = 64;            // side of one city block, in metres
export const ROAD = 14;             // width of one road, in metres
export const PITCH = BLOCK + ROAD;  // distance between road centrelines
export const HALF = 202;            // city extends from -HALF to +HALF
export const ROAD_CENTERS = [-195, -117, -39, 39, 117, 195];
export const BLOCK_CENTERS = [-156, -78, 0, 78, 156];
export const BEACH_Z = 202;         // sand strip starts here (south edge)
export const OCEAN_Z = 232;         // water plane starts here

// ---- player --------------------------------------------------------------
export const PLAYER = {
  walkSpeed: 7,
  sprintSpeed: 11,
  accel: 42,
  friction: 30,
  jumpSpeed: 8.5,
  gravity: 24,
  radius: 0.55,
  maxHealth: 100,
  startMoney: 500,
};

// ---- driving -------------------------------------------------------------
export const CAR = {
  maxSpeed: 34,          // ~122 km/h, arcade top speed
  reverseSpeed: 10,
  accel: 22,
  brake: 34,
  steer: 1.9,            // radians per second at low speed
  grip: 6.5,             // lateral velocity damping
  radius: 2.1,           // collision circle radius
};

// ---- wanted level --------------------------------------------------------
export const WANTED = {
  maxStars: 5,
  decaySeconds: 26,      // one star fades after this long without crime
  copsPerStar: [0, 1, 2, 3, 4, 6],
  copCarSpeed: 30,
  bustedSeconds: 2.5,    // cop within arm's reach this long -> busted
  fineFraction: 0.25,    // money lost when busted or wasted
};

// ---- combat --------------------------------------------------------------
export const COMBAT = {
  pistolDamage: 34,
  pistolRange: 60,
  fireInterval: 0.28,
  enemyHealth: 50,
  enemyDamage: 7,
  enemyRange: 34,
  enemyFireInterval: 0.9,
};

// ---- traffic / pedestrians ----------------------------------------------
export const TRAFFIC_CARS = 12;
export const PEDESTRIANS = 22;
export const TRAFFIC_SPEED = 9;

// ---- helpers -------------------------------------------------------------
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
export function randInt(lo, hi) { return Math.floor(rand(lo, hi + 1)); }
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function dist2D(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}
// Seeded random so the city layout is the same every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
