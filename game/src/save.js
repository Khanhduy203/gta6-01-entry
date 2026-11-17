// Solmar City — saving: one localStorage slot for money, story progress
// and where Leo was standing. One job: persist and restore, nothing else.
const KEY = 'solmar-city-save-v1';

export function saveGame(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      money: Math.floor(state.money),
      missionIndex: state.missionIndex,
      health: Math.round(state.health),
      x: state.x,
      z: state.z,
      savedAt: Date.now(),
    }));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() { return loadGame() !== null; }

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* private mode */ }
}
