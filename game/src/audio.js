// Solmar City — all sound is synthesised with WebAudio, no audio files.
// One job: make every noise the game needs (engine hum, siren, gunshot,
// pickup blip, mission jingle) from oscillators and filtered noise.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = null;
  }

  // Must be called from a user gesture (the Start button) — browsers block
  // audio contexts created any earlier.
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this._startEngineHum();
    this._startSiren();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  _startEngineHum() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 42;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  // speedRatio 0..1 while driving, 0 when on foot.
  setEngine(speedRatio, driving) {
    if (!this.engineGain) return;
    const target = driving ? 0.05 + speedRatio * 0.11 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(
      42 + speedRatio * 118, this.ctx.currentTime, 0.08);
  }

  _startSiren() {
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 660;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    let high = false;
    this.sirenTimer = setInterval(() => {
      if (!this.ctx) return;
      high = !high;
      this.sirenOsc.frequency.setTargetAtTime(
        high ? 880 : 660, this.ctx.currentTime, 0.02);
    }, 420);
  }

  // wantedStars 0..5; the siren swells as the heat rises.
  setSiren(wantedStars) {
    if (!this.sirenGain) return;
    const target = wantedStars > 0 ? 0.012 + wantedStars * 0.006 : 0;
    this.sirenGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.2);
  }

  _noiseBurst(duration, filterFreq, gainValue) {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * duration);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.value = gainValue;
    src.connect(filter); filter.connect(gain); gain.connect(this.master);
    src.start();
  }

  _tone(freq, duration, type, gainValue, slideTo) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + duration);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainValue, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain); gain.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  gunshot() { this._noiseBurst(0.14, 1800, 0.5); this._tone(140, 0.1, 'square', 0.18, 60); }
  enemyShot() { this._noiseBurst(0.12, 1200, 0.22); }
  pickup() { this._tone(660, 0.09, 'sine', 0.25); setTimeout(() => this._tone(990, 0.14, 'sine', 0.25), 90); }
  crash(strength) { this._noiseBurst(0.25, 320, 0.25 + strength * 0.4); }
  horn() { this._tone(370, 0.22, 'sawtooth', 0.12); this._tone(466, 0.22, 'sawtooth', 0.1); }
  busted() { this._tone(220, 0.5, 'sawtooth', 0.2, 110); }
  missionDone() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this._tone(f, 0.22, 'triangle', 0.28), i * 110));
  }
  missionFail() { this._tone(392, 0.3, 'sawtooth', 0.2, 196); }
  click() { this._tone(880, 0.05, 'square', 0.12); }
}
