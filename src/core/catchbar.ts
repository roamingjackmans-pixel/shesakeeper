// The reel: a fish darts up and down a track; you hold to push the green bar up and let go to let it fall. Fish in the
// bar fills the catch meter; outside, it drains. Full meter: caught. Empty: gone. A treasure chest sometimes shows up
// too: hold the bar over it long enough and it's yours. All positions are 0 (bottom) .. 1 (top) of the track.
import type { Behavior } from '../data/fish';
import { clamp, type Rng } from './rng';
import { BASE } from './stats';

export interface BarParams {
  bar: number;
  fill: number;
  drain: number;
  /** fish speed multiplier (gear calm) */
  fishSpeed: number;
  bounce: number;
  diff: number;
  beh: Behavior;
  reverse: boolean;
  treasure: boolean;
}

export interface Treasure {
  pos: number;
  prog: number;
  appearAt: number;
  shown: boolean;
  got: boolean;
}

export interface BarState {
  bar: number;
  barPos: number;
  barVel: number;
  fishPos: number;
  fishVel: number;
  target: number;
  progress: number;
  inBar: boolean;
  everLeft: boolean;
  t: number;
  lunge: number;
  /** movement state for the patterned kinds: a timer, a mode (resting/running, up/down), a wave phase */
  mt: number;
  mode: number;
  ph: number;
  treasure: Treasure | null;
  done: 'caught' | 'escaped' | null;
}

export const BAR_ACCEL = 2.1;
export const BAR_GRAVITY = 1.9;

export function newBar(rng: Rng, p: BarParams): BarState {
  const fishPos = rng.range(0.3, 0.6);
  return {
    bar: p.bar,
    barPos: clamp(fishPos - p.bar / 2, 0, 1 - p.bar),
    barVel: 0,
    fishPos,
    fishVel: 0,
    target: fishPos,
    progress: BASE.startProgress,
    inBar: true,
    everLeft: false,
    t: 0,
    lunge: 2 + rng.next() * 2,
    mt: rng.range(0.6, 1.4),
    mode: 0,
    ph: rng.range(0, Math.PI * 2),
    treasure: p.treasure ? { pos: rng.range(0.1, 0.9), prog: 0, appearAt: rng.range(0.8, 2.4), shown: false, got: false } : null,
    done: null,
  };
}

/** one step; `held` is the button (already flipped for the Upside Down modifier by the caller if wanted) */
export function stepBar(s: BarState, p: BarParams, rng: Rng, held: boolean, dt: number): 'caught' | 'escaped' | null {
  if (s.done) return null;
  s.t += dt;
  const up = p.reverse ? !held : held;
  // ---- the bar
  s.barVel += (up ? BAR_ACCEL : -BAR_GRAVITY) * dt;
  s.barPos += s.barVel * dt;
  const top = 1 - s.bar;
  if (s.barPos > top) {
    s.barPos = top;
    if (s.barVel > 0) s.barVel = 0;
  }
  if (s.barPos < 0) {
    s.barPos = 0;
    if (s.barVel < 0) s.barVel = Math.abs(s.barVel) > 0.08 ? -s.barVel * p.bounce : 0;
  }
  // ---- the fish: every species moves its own way (src/data/fish.ts MOVES)
  const d = clamp(p.diff, 0, 120) / 100;
  let k = 12 + d * 22;
  let c = 4 + d * 1.4;
  switch (p.beh) {
    case 'wave': {
      // long even waves the length of the bar
      s.ph += dt * (0.8 + 1.5 * d);
      s.target = clamp(0.5 + (0.16 + 0.17 * d) * Math.sin(s.ph) + 0.04 * Math.sin(s.ph * 2.7), 0, 1);
      k *= 1.4;
      break;
    }
    case 'burst': {
      // rests, then bolts to the far end
      s.mt -= dt;
      if (s.mode === 0) {
        if (rng.chance(1.5 * dt)) s.target = clamp(s.fishPos + rng.range(-0.04, 0.04), 0, 1);
        if (s.mt <= 0) {
          s.mode = 1;
          const jump = rng.range(0.32, 0.5 + 0.15 * d);
          s.target = clamp(s.fishPos > 0.5 ? s.fishPos - jump : s.fishPos + jump, 0.02, 0.98);
        }
      } else {
        k *= 1.5 + 0.4 * d;
        if (Math.abs(s.fishPos - s.target) < 0.05) {
          s.mode = 0;
          s.mt = rng.range(1.2, 2.5) * (1.3 - 0.5 * d);
        }
      }
      break;
    }
    case 'jumpy': {
      // quick little hops, mostly flipping direction
      s.mt -= dt;
      if (s.mt <= 0) {
        s.mt = rng.range(0.32, 0.62) * (1.25 - 0.45 * d);
        s.mode = rng.chance(0.75) ? 1 - s.mode : s.mode;
        const hop = rng.range(0.06, 0.16) * (1 + 0.7 * d);
        s.target = clamp(s.fishPos + (s.mode ? hop : -hop), 0.02, 0.98);
      }
      k *= 1.8;
      c *= 1.3;
      break;
    }
    case 'heavy': {
      // slow, but always pulling for the bottom, with hard tugs
      if (rng.chance((0.4 + d * 2.4) * dt)) s.target = rng.range(0, 0.4 + 0.3 * (1 - d));
      if (rng.chance((0.5 + d * 1.4) * dt)) s.fishVel -= rng.range(0.8, 1.8) * d;
      k *= 0.8;
      break;
    }
    case 'rush': {
      // end to end, a breather, back again
      // mt: counting down a breather (> -50), or -99 while running (the breather starts when it arrives)
      s.mt -= dt;
      if (Math.abs(s.fishPos - s.target) < 0.06) {
        if (s.mt <= -50) s.mt = rng.range(1.0, 2.1) * (1.3 - 0.5 * d);
        else if (s.mt <= 0) {
          s.mode = 1 - s.mode;
          s.target = s.mode ? rng.range(0.72, 0.95) : rng.range(0.05, 0.28);
          s.mt = -99;
        }
      }
      k *= 0.75 + 0.3 * d;
      break;
    }
    default: {
      // Stardew's kinds: mixed, dart, smooth, sinker, floater (and Hers, built on dart)
      let rate = 0.4 + d * 3.4;
      let spread = 0.12 + 0.42 * d;
      let bias = 0;
      if (p.beh === 'smooth') {
        rate *= 0.65;
        spread *= 0.7;
      } else if (p.beh === 'sinker') bias = -0.12;
      else if (p.beh === 'floater') bias = 0.12;
      if (rng.chance(rate * dt)) s.target = clamp(s.fishPos + rng.gauss() * spread + bias * rng.next(), 0, 1);
      if (p.beh === 'sinker' && s.fishPos > 0.85) s.target = Math.min(s.target, 0.6);
      if (p.beh === 'floater' && s.fishPos < 0.15) s.target = Math.max(s.target, 0.4);
      if ((p.beh === 'dart' || p.beh === 'legend') && rng.chance((0.3 + d * 1.4) * dt)) s.fishVel += (rng.chance(0.5) ? 1 : -1) * rng.range(0.8, 2) * d;
      if (p.beh === 'legend') {
        s.lunge -= dt;
        if (s.lunge <= 0) {
          s.lunge = 2.2 + rng.next() * 1.8;
          s.target = s.fishPos > 0.5 ? rng.range(0, 0.25) : rng.range(0.75, 1);
          s.fishVel += (s.target > s.fishPos ? 1 : -1) * 1.2;
        }
      }
    }
  }
  s.fishVel += ((s.target - s.fishPos) * k - s.fishVel * c) * dt;
  s.fishPos += s.fishVel * dt * p.fishSpeed;
  if (s.fishPos < 0) {
    s.fishPos = 0;
    s.fishVel = Math.max(0, s.fishVel);
  } else if (s.fishPos > 1) {
    s.fishPos = 1;
    s.fishVel = Math.min(0, s.fishVel);
  }
  // ---- catching
  const inBar = s.fishPos >= s.barPos - 0.012 && s.fishPos <= s.barPos + s.bar + 0.012;
  if (!inBar && s.inBar) s.everLeft = true;
  s.inBar = inBar;
  s.progress += (inBar ? p.fill : -p.drain) * dt;
  // ---- treasure
  const tr = s.treasure;
  if (tr && !tr.got) {
    if (!tr.shown && s.t >= tr.appearAt) tr.shown = true;
    if (tr.shown) {
      const over = tr.pos >= s.barPos && tr.pos <= s.barPos + s.bar;
      tr.prog = clamp(tr.prog + (over ? 0.75 : -0.3) * dt, 0, 1);
      if (tr.prog >= 1) tr.got = true;
    }
  }
  if (s.progress >= 1) {
    s.progress = 1;
    s.done = 'caught';
  } else if (s.progress <= 0) {
    s.progress = 0;
    s.done = 'escaped';
  }
  return s.done;
}

/**
 * A decent player: steer the bar's middle onto where the fish is heading (used by tests and the menu demo).
 * `seen` is what the player saw of the fish a reaction time ago (people don't react instantly).
 */
export function botHold(s: BarState, skill = 1, seen: { pos: number; vel: number } = { pos: s.fishPos, vel: s.fishVel }): boolean {
  const mid = s.barPos + s.bar / 2;
  const aim = seen.pos + seen.vel * 0.12 * skill;
  const want = (aim - mid) * 5 * skill;
  return s.barVel < want;
}

/** a bot with a reaction time: remembers what the fish was doing `lag` seconds ago */
export class LaggedEye {
  private buf: { pos: number; vel: number }[] = [];
  constructor(private frames: number) {}
  see(s: BarState): { pos: number; vel: number } {
    this.buf.push({ pos: s.fishPos, vel: s.fishVel });
    if (this.buf.length > this.frames) this.buf.shift();
    return this.buf[0]!;
  }
}
