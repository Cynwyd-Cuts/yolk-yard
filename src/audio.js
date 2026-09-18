export class Sound {
  constructor() {
    this.ctx = null;
    this.volume = 0.45;
    this.enabled = true;
  }
  unlock() {
    if (!this.ctx) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (Audio) this.ctx = new Audio();
    }
    this.ctx?.resume().catch(() => {});
  }
  tone(freq, duration = 0.09, type = "sine", volume = 0.15, end = 0) {
    if (!this.ctx || !this.enabled || this.volume <= 0) return;
    const c = this.ctx,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (end)
      o.frequency.exponentialRampToValueAtTime(
        Math.max(end, 20),
        c.currentTime + duration,
      );
    g.gain.setValueAtTime(volume * this.volume, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + duration);
  }
  shot(id, distance = 0) {
    const vol = 0.12 / (1 + distance / 10);
    this.tone(
      id === "needle" ? 150 : id === "scatter" ? 100 : 240,
      0.09,
      "triangle",
      vol,
      45,
    );
    this.tone(700, 0.045, "square", vol * 0.18, 120);
  }
  hit() {
    this.tone(780, 0.055, "sine", 0.15, 1250);
  }
  pop(distance = 0) {
    this.tone(85, 0.23, "triangle", 0.35 / (1 + distance / 12), 28);
  }
  pickup() {
    this.tone(630, 0.1, "sine", 0.12);
    setTimeout(() => this.tone(920, 0.14, "sine", 0.12), 70);
  }
  eliminate() {
    this.tone(550, 0.12, "triangle", 0.13);
    setTimeout(() => this.tone(850, 0.16, "triangle", 0.13), 70);
  }
  reload() {
    this.tone(240, 0.065, "triangle", 0.08);
    setTimeout(() => this.tone(420, 0.07, "triangle", 0.08), 170);
  }
}
