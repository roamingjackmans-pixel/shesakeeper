// Every sound is made here with Web Audio: no files to download. Sound effects from oscillators and noise, a
// plucked-guitar music generator (Karplus-Strong strings computed once into buffers), and ambience (water, birds,
// crickets, rain, the truck's engine). Browsers start audio on the first click or key.

export type Sfx =
  | 'hover'
  | 'click'
  | 'cast'
  | 'plop'
  | 'splash'
  | 'nibble'
  | 'bite'
  | 'hook'
  | 'reel'
  | 'catch'
  | 'new'
  | 'escape'
  | 'treasure'
  | 'cash'
  | 'buy'
  | 'reroll'
  | 'ready'
  | 'whistle'
  | 'horn'
  | 'legend'
  | 'legendCatch'
  | 'thunder'
  | 'bump'
  | 'flick'
  | 'perfect'
  | 'bad'
  | 'charge';

export type Mood = 'menu' | 'fish' | 'night' | 'drive' | 'shop' | 'legend' | 'results' | 'none';
export type Ambience = { water?: boolean; birds?: boolean; crickets?: boolean; rain?: boolean; engine?: boolean; wind?: boolean };

class Audio {
  ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musGain: GainNode | null = null;
  private ambGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private strings = new Map<number, AudioBuffer>();
  private sfxVol = 0.8;
  private musVol = 0.5;
  private mood: Mood = 'none';
  private pendingMood: Mood = 'none';
  private timer = 0;
  private nextBeat = 0;
  private beat = 0;
  private amb: { stop: () => void }[] = [];
  private ambWant: Ambience = {};
  private lastReel = 0;
  private birdTimer = 0;

  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.sfxGain = ctx.createGain();
    this.musGain = ctx.createGain();
    this.ambGain = ctx.createGain();
    this.sfxGain.connect(ctx.destination);
    this.musGain.connect(ctx.destination);
    this.ambGain.connect(this.sfxGain);
    this.sfxGain.gain.value = this.sfxVol;
    this.musGain.gain.value = this.musVol * 0.5;
    this.ambGain.gain.value = 0.6;
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.timer = window.setInterval(() => this.schedule(), 90);
    if (this.pendingMood !== 'none') this.music(this.pendingMood);
    this.ambience(this.ambWant);
    if (this.warmLater) this.warm();
  }

  setVolumes(sfx: number, music: number): void {
    this.sfxVol = sfx;
    this.musVol = music;
    if (this.sfxGain) this.sfxGain.gain.value = sfx;
    if (this.musGain) this.musGain.gain.value = music * 0.5;
  }

  // ------------------------------------------------------------------ building blocks

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, at = 0, dest?: AudioNode): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest ?? this.sfxGain!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private hiss(dur: number, vol: number, f0: number, f1: number, at = 0, type: BiquadFilterType = 'bandpass', q = 1.2): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxGain!);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  private string(freq: number): AudioBuffer {
    const key = Math.round(freq * 10);
    const hit = this.strings.get(key);
    if (hit) return hit;
    const ctx = this.ctx!;
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * 1.8);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const n = Math.max(2, Math.round(sr / freq));
    let prev = 0;
    for (let i = 0; i < n; i++) {
      const v = Math.random() * 2 - 1;
      d[i] = (v + prev) * 0.5;
      prev = v;
    }
    const decay = 0.996;
    for (let i = n; i < len; i++) d[i] = (d[i - n]! + d[i - n + 1]!) * 0.5 * decay;
    this.strings.set(key, buf);
    return buf;
  }

  private pluck(freq: number, at: number, vol: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.string(freq);
    const g = ctx.createGain();
    g.gain.value = vol;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 3200;
    src.connect(f).connect(g).connect(dest);
    src.start(at);
    src.stop(at + 1.8);
  }

  // ------------------------------------------------------------------ sound effects

  sfx(name: Sfx, opt = 1): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    switch (name) {
      case 'hover':
        this.tone('sine', 900, 1100, 0.05, 0.03);
        break;
      case 'click':
        this.tone('triangle', 520, 780, 0.08, 0.12);
        break;
      case 'charge':
        this.tone('sine', 220, 440, 0.25, 0.05);
        break;
      case 'cast':
        this.hiss(0.35, 0.35, 600, 3800, 0, 'bandpass', 1.5);
        this.tone('sine', 900, 1400, 0.25, 0.04);
        break;
      case 'plop':
        this.tone('sine', 600, 140, 0.16, 0.3);
        this.hiss(0.12, 0.12, 1800, 600);
        break;
      case 'splash':
        this.hiss(0.45, 0.4 * opt, 2500, 500, 0, 'lowpass', 0.8);
        this.tone('sine', 300, 90, 0.25, 0.2 * opt);
        break;
      case 'nibble':
        this.tone('sine', 420, 260, 0.07, 0.12);
        break;
      case 'bite':
        this.tone('square', 880, 880, 0.08, 0.1);
        this.tone('square', 1320, 1320, 0.1, 0.1, 0.09);
        this.hiss(0.2, 0.25, 2000, 700);
        break;
      case 'hook':
        this.tone('sawtooth', 300, 1200, 0.18, 0.1);
        break;
      case 'reel': {
        const now = this.ctx.currentTime;
        if (now - this.lastReel < 0.045) return;
        this.lastReel = now;
        this.tone('square', 2400 + Math.random() * 300, 1800, 0.025, 0.025);
        break;
      }
      case 'catch':
        [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.18, 0.13, i * 0.07));
        this.hiss(0.5, 0.2, 2000, 600, 0, 'lowpass');
        break;
      case 'new':
        [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone('triangle', f, f, 0.22, 0.13, i * 0.07));
        break;
      case 'perfect':
        [1047, 1319, 1568].forEach((f, i) => this.tone('sine', f, f, 0.2, 0.08, i * 0.05));
        break;
      case 'escape':
        this.tone('triangle', 400, 120, 0.5, 0.15);
        this.tone('triangle', 300, 90, 0.5, 0.1, 0.15);
        this.hiss(0.4, 0.25, 1500, 300, 0, 'lowpass');
        break;
      case 'treasure':
        [1319, 1568, 2093, 2637].forEach((f, i) => this.tone('sine', f, f, 0.25, 0.08, i * 0.06));
        break;
      case 'cash':
        this.tone('square', 1800, 1800, 0.05, 0.06);
        this.tone('square', 2400, 2400, 0.12, 0.06, 0.06);
        break;
      case 'buy':
        this.tone('triangle', 660, 660, 0.08, 0.12);
        this.tone('triangle', 990, 990, 0.15, 0.12, 0.08);
        this.tone('square', 2400, 2400, 0.1, 0.04, 0.16);
        break;
      case 'reroll':
        for (let i = 0; i < 5; i++) this.tone('triangle', 500 + i * 120, 600 + i * 120, 0.05, 0.07, i * 0.04);
        break;
      case 'ready':
        this.tone('sine', 660, 990, 0.15, 0.12);
        break;
      case 'whistle':
        this.tone('sine', 1800, 2200, 0.3, 0.12);
        this.tone('sine', 2200, 1800, 0.25, 0.1, 0.32);
        break;
      case 'horn':
        this.tone('sawtooth', 220, 210, 0.7, 0.12);
        this.tone('sawtooth', 277, 270, 0.7, 0.08);
        break;
      case 'legend': {
        for (let i = 0; i < 10; i++) this.tone('sine', 440 * Math.pow(2, i / 5), 440 * Math.pow(2, i / 5), 0.4, 0.06, i * 0.06);
        this.tone('sine', 110, 105, 2.2, 0.25, 0.6);
        break;
      }
      case 'legendCatch':
        [392, 523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => this.tone('triangle', f, f, 0.5, 0.12, i * 0.09));
        this.tone('sine', 98, 98, 2.5, 0.2, 0.7);
        break;
      case 'thunder':
        this.hiss(2.4, 0.5, 400, 60, 0.15, 'lowpass', 0.7);
        break;
      case 'bump':
        this.tone('sine', 90, 50, 0.15, 0.15);
        break;
      case 'flick':
        this.tone('sine', 300, 900, 0.08, 0.1);
        this.tone('sine', 900, 400, 0.3, 0.06, 0.08);
        break;
      case 'bad':
        this.tone('square', 200, 150, 0.15, 0.08);
        break;
    }
  }

  /** compute every guitar note the music uses ahead of time, a few per idle moment (a new note mid-song otherwise
   *  means building its string sound right then) */
  warm(): void {
    if (!this.ctx) {
      this.warmLater = true;
      return;
    }
    const freqs = new Set<number>();
    for (const cfg of Object.values(MOODS)) {
      const note = (deg: number, oct = 0) => cfg.root * Math.pow(2, (deg + oct * 12) / 12);
      for (const ch of cfg.chords) {
        freqs.add(note(ch[0]!, -1));
        for (const d of ch) {
          freqs.add(note(d));
          freqs.add(note(d + 12));
        }
      }
      for (const d of cfg.scale) freqs.add(note(d, 1));
    }
    const list = [...freqs];
    const idle = (window as unknown as { requestIdleCallback?: (cb: (d: { timeRemaining(): number }) => void) => number }).requestIdleCallback ?? ((cb: (d: { timeRemaining(): number }) => void) => window.setTimeout(() => cb({ timeRemaining: () => 8 }), 80));
    const step = (d: { timeRemaining(): number }): void => {
      while (list.length && d.timeRemaining() > 5) this.string(list.shift()!);
      if (list.length) idle(step);
    };
    idle(step);
  }
  private warmLater = false;

  // ------------------------------------------------------------------ music

  music(m: Mood): void {
    this.pendingMood = m;
    if (!this.ctx || m === this.mood) return;
    this.mood = m;
    this.beat = 0;
    this.nextBeat = this.ctx.currentTime + 0.1;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    this.ambTick();
    if (this.mood === 'none' || this.musVol <= 0) return;
    const cfg = MOODS[this.mood];
    const spb = 60 / cfg.bpm / 2;
    while (this.nextBeat < ctx.currentTime + 0.3) {
      const b = this.beat++;
      const bar = Math.floor(b / 8) % cfg.chords.length;
      const chord = cfg.chords[bar]!;
      const step = b % 8;
      const root = cfg.root;
      const note = (deg: number, oct = 0) => root * Math.pow(2, (deg + oct * 12) / 12);
      if (step === 0) this.pluck(note(chord[0]!, -1), this.nextBeat, 0.5, this.musGain!);
      const pat = cfg.pattern[step];
      if (pat !== undefined && pat >= 0) {
        const deg = chord[pat % chord.length]! + (pat >= chord.length ? 12 : 0);
        this.pluck(note(deg), this.nextBeat + (Math.random() - 0.5) * 0.01, 0.28 + Math.random() * 0.08, this.musGain!);
      }
      if (cfg.melody && step % 4 === 2 && Math.random() < cfg.melody) {
        const scale = cfg.scale;
        this.pluck(note(scale[Math.floor(Math.random() * scale.length)]!, 1), this.nextBeat, 0.18, this.musGain!);
      }
      this.nextBeat += spb;
    }
  }

  // ------------------------------------------------------------------ ambience

  ambience(a: Ambience): void {
    this.ambWant = a;
    if (!this.ctx) return;
    for (const x of this.amb) x.stop();
    this.amb = [];
    const ctx = this.ctx;
    const loopNoise = (type: BiquadFilterType, f: number, q: number, vol: number, lfo = 0) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const fl = ctx.createBiquadFilter();
      fl.type = type;
      fl.frequency.value = f;
      fl.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = vol;
      src.connect(fl).connect(g).connect(this.ambGain!);
      let osc: OscillatorNode | null = null;
      if (lfo) {
        osc = ctx.createOscillator();
        osc.frequency.value = lfo;
        const lg = ctx.createGain();
        lg.gain.value = vol * 0.6;
        osc.connect(lg).connect(g.gain);
        osc.start();
      }
      src.start();
      this.amb.push({ stop: () => (src.stop(), osc?.stop()) });
    };
    if (a.water) loopNoise('lowpass', 420, 0.7, 0.05, 0.18);
    if (a.rain) loopNoise('highpass', 1800, 0.5, 0.07);
    if (a.wind) loopNoise('bandpass', 500, 0.6, 0.04, 0.09);
    if (a.engine) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 46;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 180;
      const g = ctx.createGain();
      g.gain.value = 0.09;
      const l = ctx.createOscillator();
      l.frequency.value = 3;
      const lg = ctx.createGain();
      lg.gain.value = 4;
      l.connect(lg).connect(o.frequency);
      o.connect(f).connect(g).connect(this.ambGain!);
      o.start();
      l.start();
      this.amb.push({ stop: () => (o.stop(), l.stop()) });
      loopNoise('lowpass', 300, 0.5, 0.03);
    }
  }

  private ambTick(): void {
    if (!this.ctx) return;
    this.birdTimer -= 0.09;
    if (this.birdTimer > 0) return;
    this.birdTimer = 1.5 + Math.random() * 4;
    if (this.ambWant.birds) {
      const f = 2200 + Math.random() * 1600;
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) this.tone('sine', f, f * (1.2 + Math.random() * 0.3), 0.08, 0.025, i * 0.11, this.ambGain!);
    }
    if (this.ambWant.crickets) for (let i = 0; i < 6; i++) this.tone('square', 4400, 4400, 0.02, 0.008, i * 0.05, this.ambGain!);
  }
}

const MOODS: Record<Exclude<Mood, 'none'>, { bpm: number; root: number; chords: number[][]; pattern: number[]; scale: number[]; melody?: number }> = {
  menu: { bpm: 84, root: 196, chords: [[0, 4, 7], [5, 9, 12], [9, 12, 16], [7, 11, 14]], pattern: [0, 2, 1, 2, 3, 2, 1, 2], scale: [0, 2, 4, 7, 9], melody: 0.45 },
  fish: { bpm: 76, root: 220, chords: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], pattern: [0, -1, 2, 1, -1, 2, 3, -1], scale: [0, 2, 4, 7, 9], melody: 0.35 },
  night: { bpm: 66, root: 220, chords: [[0, 3, 7], [8, 12, 15], [5, 8, 12], [7, 10, 14]], pattern: [0, -1, 1, -1, 2, -1, 1, -1], scale: [0, 3, 5, 7, 10], melody: 0.3 },
  drive: { bpm: 112, root: 196, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], pattern: [0, 2, 1, 2, 0, 2, 3, 2], scale: [0, 2, 4, 7, 9], melody: 0.5 },
  shop: { bpm: 100, root: 262, chords: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]], pattern: [0, 1, 2, 1, 3, 1, 2, 1], scale: [0, 2, 4, 5, 7, 9], melody: 0.5 },
  legend: { bpm: 92, root: 196, chords: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [11, 14, 17]], pattern: [0, 1, 2, 3, 0, 1, 2, 3], scale: [0, 1, 3, 7, 8], melody: 0.6 },
  results: { bpm: 90, root: 233, chords: [[0, 4, 7], [5, 9, 12], [0, 4, 7], [7, 11, 14]], pattern: [0, 2, 1, 3, 0, 2, 1, 3], scale: [0, 2, 4, 7, 9, 12], melody: 0.5 },
};

export const audio = new Audio();
