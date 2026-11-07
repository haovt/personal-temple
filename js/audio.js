// Web Audio engine: real recordings (see CREDITS.md), a soft hall reverb, a quiet
// ambience bed that changes with the place you are in, master volume and mute.
//
// Browsers only allow sound after the visitor has interacted with the page, so the
// AudioContext is resumed (and the ambience started) on the first click or key press.
// Effect recordings are decoded up front, so a click plays without delay; the long
// ambience is streamed from an <audio> element instead of being decoded into memory.

const SOUNDS = {
  // name: file, where the useful part starts (s), how long to play (s), loudness, reverb send
  'great-bell': { src: 'assets/sounds/effects/temple-bell-1532.mp3', gain: 1.0, wet: 0.5 },
  'bowl-bell':  { src: 'assets/sounds/effects/singing-bowl-1.ogg', offset: 0.08, gain: 0.75, wet: 0.3 },
  'wooden-fish': { src: 'assets/sounds/effects/mokugyo.mp3', gain: 0.9, wet: 0.22 },
  incense:      { src: 'assets/sounds/effects/lighting-incense.mp3', offset: 0.35, gain: 0.8, wet: 0.08 },
  candle:       { src: 'assets/sounds/effects/match-light-candle.mp3', offset: 6.2, duration: 2.6, gain: 0.7, wet: 0.1 },
  rattle:       { src: 'assets/sounds/effects/bamboo-rattle.mp3', offset: 29.5, duration: 2.2, gain: 0.75, wet: 0.12 },
  'candle-out': { src: 'assets/sounds/effects/candle-blow-out.mp3', offset: 1.25, duration: 0.75, gain: 0.55, wet: 0.15 },
  flowers:      { src: 'assets/sounds/effects/flowers-rustle.mp3', offset: 1.7, duration: 1.8, gain: 1.6, wet: 0.1 },
};

const AMBIENCE = {
  bed: 'assets/sounds/ambient/garden-birds.mp3',          // birds and garden air, 4 min loop
  chimes: 'assets/sounds/ambient/truclam-wind-chimes.mp3',  // wind chimes, played now and then
};

// How the surroundings sound in each place: outdoors open and present,
// indoors quieter and muffled (heard through the walls of the hall).
const OUTDOOR = { bed: 0.34, cutoff: 14000, chimes: 0.22 };
const INDOOR = { bed: 0.13, cutoff: 1500, chimes: 0.08 };
const PLACES = {
  entrance: OUTDOOR,
  incense: OUTDOOR,
  bell: { bed: 0.3, cutoff: 9000, chimes: 0.26 },
  'main-hall': INDOOR,
  fortune: INDOOR,
};

export class TempleAudio {
  constructor() {
    this.ready = false;
    this.muted = false;
    this.volume = 0.85;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;                        // no Web Audio: the temple stays silent

    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    // Gentle limiter so a bell struck over a ringing bell never distorts.
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    this.master.connect(limiter).connect(this.ctx.destination);

    // A hall-like reverb from a generated impulse response (decaying stereo noise).
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this.#impulse(3.4, 2.6);
    this.reverbOut = this.ctx.createGain();
    this.reverbOut.gain.value = 0.9;
    this.reverb.connect(this.reverbOut).connect(this.master);

    // Ambience: <audio> bed → low-pass (muffling indoors) → level → master
    this.ambFilter = this.ctx.createBiquadFilter();
    this.ambFilter.type = 'lowpass';
    this.ambFilter.frequency.value = OUTDOOR.cutoff;
    this.ambFilter.Q.value = 0.5;
    this.bedGain = this.ctx.createGain();
    this.bedGain.gain.value = 0;
    this.chimeGain = this.ctx.createGain();
    this.chimeGain.gain.value = OUTDOOR.chimes;
    this.ambFilter.connect(this.bedGain).connect(this.master);
    this.chimeGain.connect(this.master);
    this.place = OUTDOOR;

    this.bed = new Audio(AMBIENCE.bed);
    this.bed.loop = true;
    this.bed.preload = 'auto';
    this.ctx.createMediaElementSource(this.bed).connect(this.ambFilter);
    this.chimeBuffer = fetch(AMBIENCE.chimes)
      .then((r) => r.arrayBuffer())
      .then((b) => this.ctx.decodeAudioData(b))
      .catch(() => null);

    this.buffers = new Map();
    this.loading = Promise.all(Object.entries(SOUNDS).map(async ([name, s]) => {
      try {
        const data = await fetch(s.src).then((r) => r.arrayBuffer());
        this.buffers.set(name, await this.ctx.decodeAudioData(data));
      } catch (err) {
        console.warn(`Sound "${name}" could not be loaded`, err);
      }
    })).then(() => { this.ready = true; });

    // Unlock on the first interaction, then start the ambience.
    const unlock = () => {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.#startAmbience();
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);

    // Go quiet while the tab is hidden; come back when it is shown again.
    document.addEventListener('visibilitychange', () => {
      if (!this.started) return;
      if (document.hidden) { this.bed.pause(); this.ctx.suspend(); }
      else { this.ctx.resume(); this.bed.play().catch(() => {}); }
    });
  }

  /** Change the ambience to suit a place (scene id). */
  setScene(id) {
    this.place = PLACES[id] || OUTDOOR;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.ambFilter.frequency.setTargetAtTime(this.place.cutoff, t, 0.4);
    this.chimeGain.gain.setTargetAtTime(this.place.chimes, t, 0.4);
    if (this.started) this.bedGain.gain.setTargetAtTime(this.place.bed, t, 0.5);
  }

  #startAmbience() {
    if (this.started || !this.ctx) return;
    this.started = true;
    this.bed.play().catch(() => {});
    this.bedGain.gain.setTargetAtTime(this.place.bed, this.ctx.currentTime, 1.5);   // slow fade-in
    this.#scheduleChimes(18000 + Math.random() * 12000);
  }

  /** The wind chimes sound now and then, never on a fixed beat. */
  #scheduleChimes(delay) {
    clearTimeout(this.chimeTimer);
    this.chimeTimer = setTimeout(async () => {
      const buf = await this.chimeBuffer;
      if (buf && !this.muted && !document.hidden) {
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = 0.94 + Math.random() * 0.1;
        src.connect(this.chimeGain);
        src.start();
        src.onended = () => src.disconnect();
      }
      this.#scheduleChimes(55000 + Math.random() * 65000);
    }, delay);
  }

  /** Play a named sound. Options: gain (×), rate (pitch/speed). */
  async play(name, { gain = 1, rate = 1 } = {}) {
    if (!this.ctx || this.muted) return;
    if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => {});
    this.#startAmbience();                      // a sound means the visitor has interacted
    await this.loading;
    const buf = this.buffers.get(name);
    const s = SOUNDS[name];
    if (!buf || !s) return;

    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;

    const level = this.ctx.createGain();
    const g = s.gain * gain;
    level.gain.setValueAtTime(0, t);
    level.gain.linearRampToValueAtTime(g, t + 0.006);      // avoid a click at the cut point
    const offset = s.offset || 0;
    const duration = s.duration || buf.duration - offset;
    if (s.duration) {                                       // fade out a trimmed excerpt
      level.gain.setValueAtTime(g, t + duration / rate - 0.4);
      level.gain.linearRampToValueAtTime(0, t + duration / rate);
    }

    const send = this.ctx.createGain();
    send.gain.value = s.wet;

    src.connect(level);
    level.connect(this.master);
    level.connect(send).connect(this.reverb);
    src.start(t, offset, duration);
    src.onended = () => { src.disconnect(); level.disconnect(); send.disconnect(); };
  }

  setMuted(muted) {
    this.muted = muted;
    this.#applyLevel();
  }

  /** Master volume, 0…1. */
  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v));
    this.#applyLevel();
  }

  #applyLevel() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, t, 0.08);
  }

  #impulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.round(seconds * rate);
    const ir = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const k = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - k, decay) * (i < rate * 0.012 ? i / (rate * 0.012) : 1);
      }
    }
    return ir;
  }
}
