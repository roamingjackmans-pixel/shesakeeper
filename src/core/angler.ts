// One angler on the shore, step by step: aim, hold to charge the cast meter, let go to cast, wait for the bobber to
// dip, click to hook, reel with the catch bar, hold the fish up. It runs on the player's own machine (even in
// co-op: only the shared lake comes from the host) and reports what happened as events.
import { modFlags, type ModFlags } from '../data/charms';
import { FISH, MARLENE, weightKg, type Species } from '../data/fish';
import { newBar, stepBar, type BarParams, type BarState } from './catchbar';
import { holePool, pickSpecies, rollQuality, rollSize, sizeFrac } from './fishpool';
import { Rng, clamp } from './rng';
import { scoreCatch } from './scoring';
import { BASE, derived, type Derived, type Stats } from './stats';
import type { Catch, HoleSpec } from './types';
import { LAKE, type Bubble, type HoleWorld } from './world';

export type APhase = 'ready' | 'charging' | 'flying' | 'waiting' | 'bite' | 'reeling' | 'landing' | 'reelin' | 'snapped' | 'done';

export interface AnglerInput {
  held: boolean;
  pressed: boolean;
  released: boolean;
  cancel: boolean;
  /** radians: 0 straight out, negative left */
  aim: number;
}

export type TreasureReward = { kind: 'cash'; amount: number } | { kind: 'charm'; seed: number } | { kind: 'ornament'; seed: number };

export type AEvent =
  | { k: 'charge' }
  | { k: 'cast'; power: number; perfect: boolean }
  | { k: 'land'; x: number; z: number; bubble: boolean; bullseye: boolean; legend: boolean }
  | { k: 'nibble' }
  | { k: 'bite'; legend: boolean }
  | { k: 'claim'; id: number; legend: boolean }
  | { k: 'hook'; legend: boolean }
  | { k: 'save' }
  | { k: 'miss'; legend: boolean }
  | { k: 'early' }
  | { k: 'catch'; c: Catch; second?: boolean }
  | { k: 'escape'; id: string; legend: boolean }
  | { k: 'treasure'; reward: TreasureReward }
  | { k: 'snap' }
  | { k: 'lost-bubble' };

/** what other players need to draw this angler */
export interface AnglerView {
  x: number;
  phase: APhase;
  aim: number;
  power: number;
  bx: number;
  bz: number;
  /** bobber height while flying (m) */
  bh: number;
  /** 0..1 how far the bobber is pulled under */
  dip: number;
  fish: string;
  prog: number;
  /** the bar's fish height 0..1, for the line wiggle */
  fy: number;
}

export const AIM_MAX = 1.05;

export interface AnglerOpts {
  x: number;
  seed: number;
  stats: Stats;
  hole: HoleSpec;
  mods: string[];
  charms: string[];
}

export class Angler {
  x: number;
  phase: APhase = 'ready';
  /** seconds in the current phase */
  pt = 0;
  aim = 0;
  power = 0;
  chargeT = 0;
  bx = 0;
  bz = 0;
  bh = 0;
  private fromX = 0;
  private fromZ = 0;
  toX = 0;
  toZ = 0;
  private flightDur = 0.5;
  /** the current cast */
  cast = { power: 0, perfect: false, long: false, bullseye: false, bubble: null as number | null, legend: false, far: 0 };
  private biteAt = 0;
  private bubbleFactor = 1;
  private nibbles: number[] = [];
  dip = 0;
  hookLeft = 0;
  fish: { sp: Species; cm: number } | null = null;
  bar: BarState | null = null;
  barParams: BarParams | null = null;
  streak = 0;
  catches: Catch[] = [];
  seen: string[] = [];
  /** the last catch, held up during 'landing' */
  shown: Catch | null = null;
  points = 0;
  escapes = 0;
  readonly d: Derived;
  readonly flags: ModFlags;
  readonly stats: Stats;
  readonly hole: HoleSpec;
  readonly charms: string[];
  private rng: Rng;
  private pool: Species[];
  private overT = 0;

  constructor(o: AnglerOpts) {
    this.x = o.x;
    this.bx = o.x;
    this.stats = o.stats;
    this.d = derived(o.stats);
    this.flags = modFlags(o.mods);
    this.hole = o.hole;
    this.charms = o.charms;
    this.rng = new Rng(o.seed);
    this.pool = holePool(o.hole.biome, o.hole.time);
  }

  /** the furthest this angler can cast (m) */
  get reach(): number {
    return this.d.castMax;
  }

  /** where a cast at this power would land (no wind or wobble) */
  landingFor(power: number, aim = this.aim): { x: number; z: number } {
    const dist = BASE.castMin + clamp(power, 0, 1) * (this.d.castMax - BASE.castMin);
    return { x: clamp(this.x + Math.sin(aim) * dist, -LAKE.halfWidth, LAKE.halfWidth), z: clamp(Math.cos(aim) * dist, LAKE.near, LAKE.far) };
  }

  private go(p: APhase): void {
    this.phase = p;
    this.pt = 0;
  }

  update(dt: number, inp: AnglerInput, world: HoleWorld): AEvent[] {
    const ev: AEvent[] = [];
    this.pt += dt;
    if (this.phase !== 'reeling' && this.phase !== 'flying') this.aim = clamp(inp.aim, -AIM_MAX, AIM_MAX);
    if (world.over && this.phase !== 'done') {
      // the hole is over: finish a fish on the line, drop anything else
      if (this.phase === 'reeling') {
        this.overT += dt;
        // 25 seconds after the whistle the fish wins, wherever it is
        if (this.overT > 25 && this.fish) {
          this.escaped(ev);
          return ev;
        }
      } else if (this.phase !== 'landing' || this.pt > 1.2) {
        this.go('done');
        this.fish = null;
        this.bar = null;
        this.dip = 0;
        return ev;
      }
    }
    switch (this.phase) {
      case 'ready':
        this.bx = this.x;
        this.bz = 0;
        if (inp.pressed) {
          this.go('charging');
          this.chargeT = 0;
          this.power = 0;
          ev.push({ k: 'charge' });
        }
        break;
      case 'charging': {
        this.chargeT += dt;
        const ph = (this.chargeT / this.d.castPeriod) % 1;
        this.power = ph < 0.5 ? ph * 2 : 2 - ph * 2;
        if (inp.cancel) {
          this.go('ready');
          break;
        }
        if (inp.released || !inp.held) this.release(ev, world);
        break;
      }
      case 'flying': {
        const u = Math.min(1, this.pt / this.flightDur);
        this.bx = this.fromX + (this.toX - this.fromX) * u;
        this.bz = this.fromZ + (this.toZ - this.fromZ) * u;
        this.bh = Math.sin(Math.PI * u) * (1.5 + this.cast.far * 9);
        if (u >= 1) this.land(ev, world);
        break;
      }
      case 'waiting': {
        this.dip = Math.max(0, this.dip - dt * 4);
        if (this.cast.bubble !== null && !world.bubbles.some((b) => b.id === this.cast.bubble)) {
          // somebody else emptied our bubble: back to an ordinary wait
          const left = Math.max(0, this.biteAt - this.pt);
          this.biteAt = this.pt + Math.min(6, left / Math.max(0.05, this.bubbleFactor));
          this.cast.bubble = null;
          this.cast.bullseye = false;
          this.cast.legend = false;
          ev.push({ k: 'lost-bubble' });
        }
        if (this.nibbles.length && this.pt >= this.nibbles[0]!) {
          this.nibbles.shift();
          this.dip = 0.35;
          ev.push({ k: 'nibble' });
        }
        if (inp.cancel || inp.pressed) {
          ev.push({ k: 'early' });
          this.go('reelin');
          break;
        }
        if (this.pt >= this.biteAt) this.bite(ev, world);
        break;
      }
      case 'bite':
        this.dip = 1;
        this.hookLeft -= dt;
        if (inp.pressed) this.hook(ev);
        else if (this.hookLeft <= 0) {
          if (this.rng.chance(this.d.hookSave)) {
            ev.push({ k: 'save' });
            this.hook(ev);
          } else {
            ev.push({ k: 'miss', legend: this.fish?.sp.id === 'marlene' });
            this.fish = null;
            this.go('reelin');
          }
        }
        break;
      case 'reeling': {
        const bar = this.bar!;
        const r = stepBar(bar, this.barParams!, this.rng, inp.held, dt);
        if (r === 'caught') this.caught(ev, world);
        else if (r === 'escaped') this.escaped(ev);
        break;
      }
      case 'landing':
        if (this.pt > 1.6 || (inp.pressed && this.pt > 0.35)) this.go('ready');
        break;
      case 'reelin':
        this.dip = 0;
        this.bx += (this.x - this.bx) * Math.min(1, dt * 8);
        this.bz += (0 - this.bz) * Math.min(1, dt * 8);
        if (this.pt > 0.45) this.go('ready');
        break;
      case 'snapped':
        if (this.pt >= (this.flags.snap ?? 0)) this.go('ready');
        break;
      case 'done':
        break;
    }
    return ev;
  }

  private release(ev: AEvent[], world: HoleWorld): void {
    const p = this.power;
    const perfect = p >= 1 - this.d.perfectWindow;
    const dist = (BASE.castMin + p * (this.d.castMax - BASE.castMin)) * (perfect ? 1.04 : 1);
    let x = this.x + Math.sin(this.aim) * dist;
    let z = Math.cos(this.aim) * dist;
    if (this.flags.wind) x += this.hole.wind * dist * 0.22;
    if (!perfect) {
      x += this.rng.gauss() * 0.25 * (dist / 20);
      z += this.rng.gauss() * 0.25;
    }
    this.toX = clamp(x, -LAKE.halfWidth, LAKE.halfWidth);
    this.toZ = clamp(z, LAKE.near, LAKE.far);
    this.fromX = this.x;
    this.fromZ = 0.5;
    this.flightDur = 0.35 + dist / 55;
    this.cast = { power: p, perfect, long: p >= 0.75, bullseye: false, bubble: null, legend: false, far: clamp(this.toZ / 50, 0, 1) };
    ev.push({ k: 'cast', power: p, perfect });
    void world;
    this.go('flying');
  }

  private land(ev: AEvent[], world: HoleWorld): void {
    this.bx = this.toX;
    this.bz = this.toZ;
    this.bh = 0;
    const b: Bubble | null = world.bubbleAt(this.bx, this.bz);
    const rng = this.rng;
    let delay = rng.range(BASE.biteMin, BASE.biteMax) * this.d.biteMul;
    this.bubbleFactor = 1;
    if (b) {
      const dd = Math.hypot(b.x - this.bx, b.z - this.bz);
      this.cast.bubble = b.id;
      this.cast.bullseye = dd <= b.r * 0.4;
      if (b.legend && world.legend === 1) {
        this.cast.legend = rng.chance(0.45 + this.d.legend * 0.5);
        if (this.cast.legend) delay = rng.range(1.5, 3.2);
      }
      if (!this.cast.legend) {
        this.bubbleFactor = this.cast.bullseye ? BASE.bullseyeBite / (1 + Math.max(-0.6, this.stats.bubbleBoost)) : this.d.bubbleBite;
        delay *= this.bubbleFactor;
      }
    }
    delay = Math.max(0.55, delay);
    this.biteAt = delay;
    this.nibbles = [];
    if (delay > 1.4) {
      const n = rng.int(0, 2);
      for (let i = 0; i < n; i++) this.nibbles.push(rng.range(0.4, delay - 0.5));
      this.nibbles.sort((a, c) => a - c);
    }
    ev.push({ k: 'land', x: this.bx, z: this.bz, bubble: !!b, bullseye: this.cast.bullseye, legend: this.cast.legend });
    this.go('waiting');
  }

  private bite(ev: AEvent[], world: HoleWorld): void {
    const rng = this.rng;
    let sp: Species;
    const legend = this.cast.legend && world.legend === 1;
    if (legend) sp = MARLENE;
    else {
      this.cast.legend = false;
      sp = pickSpecies(rng, this.pool, this.stats, this.d, { weather: this.hole.weather, bubble: this.cast.bubble !== null, bullseye: this.cast.bullseye, far: this.cast.far });
    }
    const cm = rollSize(rng, sp, this.d, this.cast.far, sp.id === 'marlene' ? 1 : (this.flags.sizeMul ?? 1));
    this.fish = { sp, cm };
    this.hookLeft = this.d.hookWindow * (legend ? 0.8 : 1);
    if (this.cast.bubble !== null) ev.push({ k: 'claim', id: this.cast.bubble, legend });
    ev.push({ k: 'bite', legend });
    this.go('bite');
  }

  private hook(ev: AEvent[]): void {
    const f = this.fish;
    if (!f) return this.go('reelin');
    const legend = f.sp.id === 'marlene';
    const diff = f.sp.diff + (sizeFrac(f.sp, f.cm) - 0.5) * 14 + (this.flags.diffAdd ?? 0);
    this.barParams = {
      bar: this.d.bar,
      fill: this.d.fill * (legend ? 0.72 : 1),
      drain: this.d.drain * (legend ? 1.15 : 1),
      fishSpeed: this.d.fishSpeed,
      bounce: this.d.bounce,
      diff,
      beh: f.sp.beh,
      reverse: !!this.flags.reverse,
      treasure: !legend && this.rng.chance(this.d.treasure),
    };
    this.bar = newBar(this.rng, this.barParams);
    this.overT = 0;
    ev.push({ k: 'hook', legend });
    this.go('reeling');
  }

  private treasure(ev: AEvent[]): void {
    const r = this.rng.next();
    const roll = Math.floor(this.rng.next() * 2 ** 31);
    if (r < 0.1) ev.push({ k: 'treasure', reward: { kind: 'ornament', seed: roll } });
    else if (r < 0.26) ev.push({ k: 'treasure', reward: { kind: 'charm', seed: roll } });
    else ev.push({ k: 'treasure', reward: { kind: 'cash', amount: Math.round(((40 + this.rng.next() * 130) * this.d.treasureValue * (1 + this.hole.idx * 0.35)) / 5) * 5 } });
  }

  private record(sp: Species, cm: number, world: HoleWorld, extra: { second?: boolean } = {}): Catch {
    const bar = this.bar!;
    const perfect = !bar.everLeft;
    const q = rollQuality(this.rng, sp, cm, this.d, { perfect, perfectCast: this.cast.perfect, bullseye: this.cast.bullseye });
    const core = {
      id: sp.id,
      cm,
      kg: weightKg(sp, cm),
      q,
      perfect,
      perfectCast: this.cast.perfect,
      bullseye: this.cast.bullseye,
      bubble: this.cast.bubble !== null || this.cast.legend,
      long: this.cast.long,
      treasure: !!bar.treasure?.got && !extra.second,
      reelTime: Math.round(bar.t * 10) / 10,
      t: Math.round(world.t * 10) / 10,
    };
    const s = scoreCatch(core, {
      stats: this.stats,
      d: this.d,
      mission: this.hole.mission,
      missionDouble: !!this.flags.missionDouble,
      charms: this.charms,
      time: this.hole.time,
      weather: this.hole.weather,
      streak: this.streak,
      seen: this.seen,
      count: this.catches.length,
      holeLen: this.hole.seconds,
      charged: world.isCharged(),
    });
    const c: Catch = { ...core, points: s.points, mission: s.mission, fresh: !this.seen.includes(sp.id), why: s.why };
    this.catches.push(c);
    if (!this.seen.includes(sp.id)) this.seen.push(sp.id);
    this.points += c.points;
    this.streak += 1;
    return c;
  }

  private caught(ev: AEvent[], world: HoleWorld): void {
    const f = this.fish!;
    const c = this.record(f.sp, f.cm, world);
    ev.push({ k: 'catch', c });
    if (this.bar?.treasure?.got) this.treasure(ev);
    if (f.sp.id !== 'marlene' && !f.sp.tags.includes('junk') && this.rng.chance(this.d.double)) {
      const cm2 = Math.max(f.sp.cm[0], Math.round(rollSize(this.rng, f.sp, this.d, this.cast.far, this.flags.sizeMul ?? 1) * 0.9 * 10) / 10);
      ev.push({ k: 'catch', c: this.record(f.sp, cm2, world, { second: true }), second: true });
    }
    this.shown = c;
    this.fish = null;
    this.go('landing');
  }

  private escaped(ev: AEvent[]): void {
    const f = this.fish!;
    if (this.bar?.treasure?.got) this.treasure(ev);
    this.streak = 0;
    this.escapes++;
    ev.push({ k: 'escape', id: f.sp.id, legend: f.sp.id === 'marlene' });
    this.fish = null;
    if (this.flags.snap) {
      ev.push({ k: 'snap' });
      this.go('snapped');
    } else this.go('reelin');
  }

  /** co-op: someone else's claim on Her reached the host first, so she isn't on our line after all */
  forfeitLegend(): boolean {
    if (this.fish?.sp.id !== 'marlene' || (this.phase !== 'bite' && this.phase !== 'reeling')) return false;
    this.fish = null;
    this.bar = null;
    this.dip = 0;
    this.go('reelin');
    return true;
  }

  view(): AnglerView {
    return {
      x: this.x,
      phase: this.phase,
      aim: Math.round(this.aim * 100) / 100,
      power: Math.round(this.power * 100) / 100,
      bx: Math.round(this.bx * 10) / 10,
      bz: Math.round(this.bz * 10) / 10,
      bh: Math.round(this.bh * 10) / 10,
      dip: Math.round(this.dip * 100) / 100,
      fish: this.phase === 'reeling' ? (this.fish?.sp.id ?? '') : this.phase === 'landing' ? (this.shown?.id ?? '') : '',
      prog: this.bar ? Math.round(this.bar.progress * 100) / 100 : 0,
      fy: this.bar ? Math.round(this.bar.fishPos * 100) / 100 : 0.5,
    };
  }
}

export function speciesName(id: string): string {
  return FISH[id]?.name ?? id;
}
