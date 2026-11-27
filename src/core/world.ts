// The lake everyone shares at a fishing hole: the clock, bubble spots (cast into one for a fast bite; each holds a
// few fish, then pops), Her golden ripple, and storm lightning. In co-op the host runs it and sends snapshots;
// guests only show them. Solo, it runs locally the same way.
import { modFlags, type ModFlags } from '../data/charms';
import { Rng } from './rng';
import type { HoleSpec } from './types';

export interface Bubble {
  id: number;
  x: number;
  z: number;
  r: number;
  cap: number;
  born: number;
  life: number;
  legend?: boolean;
}

export interface WorldSnap {
  t: number;
  bubbles: Bubble[];
  flash: number;
  charged: number;
  legend: 0 | 1 | 2 | 3;
  over: boolean;
}

/** how far the lake goes (metres): sideways from the middle, and out from the shore */
export const LAKE = { halfWidth: 40, near: 3, far: 58 };
/** bubbles spawn inside this box */
const SPAWN = { x: 30, zMin: 8, zMax: 55 };

export class HoleWorld {
  t = 0;
  bubbles: Bubble[] = [];
  /** time of the last lightning flash (-99 none) */
  flash = -99;
  /** double points until this time (Storm Chaser) */
  charged = -1;
  /** 0 not yet, 1 her ripple is up, 2 hooked by someone, 3 gone */
  legend: 0 | 1 | 2 | 3 = 0;
  over = false;
  readonly flags: ModFlags;
  readonly seconds: number;
  private rng: Rng;
  private nextId = 1;
  private nextSpawn = 1.5;
  private nextFlash: number;
  /** spawn-rate multiplier (bubble-rate perks of the players, averaged) */
  rate = 1;
  /** the best chance anyone on the lake has of drawing Her out */
  legendChance = 0;

  constructor(
    readonly spec: HoleSpec,
    mods: string[],
  ) {
    this.flags = modFlags(mods);
    this.seconds = spec.seconds;
    this.rng = new Rng(spec.seed ^ 0x51a7);
    this.nextFlash = 6 + this.rng.next() * 8;
    // a couple of bubbles up from the start
    this.spawn();
    this.spawn();
  }

  get remaining(): number {
    return Math.max(0, this.seconds - this.t);
  }

  isCharged(): boolean {
    return this.t < this.charged;
  }

  private spawn(legend = false): void {
    const r = this.rng;
    let x = 0;
    let z = 0;
    for (let tries = 0; tries < 12; tries++) {
      x = r.range(-SPAWN.x, SPAWN.x);
      z = r.range(SPAWN.zMin, SPAWN.zMax);
      if (this.bubbles.every((b) => Math.hypot(b.x - x, b.z - z) > 9)) break;
    }
    const cap = legend ? 1 : (this.flags.bubbleCap ?? r.int(1, 3));
    this.bubbles.push({ id: this.nextId++, x, z, r: legend ? 3.4 : r.range(2.1, 2.9), cap, born: this.t, life: legend ? 32 : r.range(18, 30), legend });
  }

  /** authority only */
  update(dt: number): void {
    if (this.over) return;
    this.t += dt;
    const maxUp = this.flags.bubbleRateMul && this.flags.bubbleRateMul > 1 ? 9 : 4;
    this.nextSpawn -= dt * this.rate * (this.flags.bubbleRateMul ?? 1);
    if (this.nextSpawn <= 0) {
      this.nextSpawn = 6.5 + this.rng.next() * 5;
      if (this.bubbles.filter((b) => !b.legend).length < maxUp) this.spawn();
    }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i]!;
      if (this.t - b.born > b.life) {
        this.bubbles.splice(i, 1);
        if (b.legend && this.legend === 1) this.legend = 3;
      }
    }
    if (this.legend === 0 && this.t >= this.spec.legendAt && this.t < this.seconds - 20) {
      const comes = this.flags.legendAlways || this.spec.legendRoll < this.legendChance;
      if (comes) {
        this.spawn(true);
        this.legend = 1;
      } else this.legend = 3;
    }
    if (this.spec.weather === 'storm') {
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) {
        this.nextFlash = 9 + this.rng.next() * 9;
        this.flash = this.t;
        if (this.flags.charged) this.charged = this.t + 8;
      }
    }
    if (this.t >= this.seconds) {
      this.t = this.seconds;
      this.over = true;
    }
  }

  bubbleAt(x: number, z: number): Bubble | null {
    let best: Bubble | null = null;
    let bd = Infinity;
    for (const b of this.bubbles) {
      const d = Math.hypot(b.x - x, b.z - z);
      if (d <= b.r && d < bd) {
        best = b;
        bd = d;
      }
    }
    return best;
  }

  /** a fish was taken from a bubble: one fewer in it (authority) */
  claim(id: number): void {
    const i = this.bubbles.findIndex((b) => b.id === id);
    if (i < 0) return;
    const b = this.bubbles[i]!;
    b.cap -= 1;
    if (b.legend) this.legend = 2;
    if (b.cap <= 0) this.bubbles.splice(i, 1);
  }

  /** She got away (or was landed): no more ripple this hole */
  legendGone(): void {
    this.legend = 3;
    this.bubbles = this.bubbles.filter((b) => !b.legend);
  }

  snap(): WorldSnap {
    return { t: this.t, bubbles: this.bubbles.map((b) => ({ ...b })), flash: this.flash, charged: this.charged, legend: this.legend, over: this.over };
  }

  apply(s: WorldSnap): void {
    // keep our own smooth clock unless it drifted
    if (Math.abs(s.t - this.t) > 0.35) this.t = s.t;
    this.bubbles = s.bubbles;
    this.flash = s.flash;
    this.charged = s.charged;
    this.legend = s.legend;
    this.over = s.over;
  }

  /** guests: let the clock run between snapshots */
  tick(dt: number): void {
    if (!this.over) this.t = Math.min(this.seconds, this.t + dt);
  }
}
