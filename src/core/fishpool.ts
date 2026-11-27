// Which fish bites: the water, the time of day and the weather decide who is down there; bait, lures, bubbles and
// how far you cast decide who takes the hook. Then its size and how good a catch it was.
import { SPECIES, avgCm, type Biome, type Species, type TimeOfDay, type Weather } from '../data/fish';
import { clamp, type Rng } from './rng';
import type { Derived, Stats } from './stats';

export function holePool(biome: Biome, time: TimeOfDay): Species[] {
  return SPECIES.filter((s) => s.biomes.includes(biome) && (!s.times || s.times.includes(time)));
}

export interface BiteCtx {
  weather: Weather;
  bubble: boolean;
  bullseye: boolean;
  /** 0..1: how far out the bobber is, of the furthest anyone can cast */
  far: number;
  /** metres out from the shore: a fish only bites when the bobber is at least its `dist` out */
  z: number;
}

/** the fish that can bite this far out (the shore fish always can: nobody gets nothing) */
export function reachable(pool: Species[], z: number): Species[] {
  const ok = pool.filter((s) => s.dist <= z);
  if (ok.length) return ok;
  const nearest = Math.min(...pool.map((s) => s.dist));
  return pool.filter((s) => s.dist <= nearest);
}

export function speciesWeight(s: Species, st: Stats, d: Derived, c: BiteCtx): number {
  let w = s.w;
  if (s.weather?.includes(c.weather)) w *= 2;
  if (s.tags.includes('rare')) w *= d.rare * (c.bubble ? 1.6 : 1) * (c.bullseye ? 1.3 : 1);
  for (const t of s.tags) {
    const a = st.attract[t];
    if (a) w *= Math.max(0.05, 1 + a);
  }
  if (s.cm[1] >= 70) w *= 0.55 + 0.9 * c.far;
  else if (s.cm[1] <= 25) w *= 1.35 - 0.6 * c.far;
  if (s.tags.includes('junk') && c.bubble) w *= 0.3;
  return w;
}

export function pickSpecies(rng: Rng, pool: Species[], st: Stats, d: Derived, c: BiteCtx): Species {
  return rng.weighted(reachable(pool, c.z), (s) => speciesWeight(s, st, d, c));
}

/** a length in cm; gear can push it past the species' usual maximum (a monster!) */
export function rollSize(rng: Rng, s: Species, d: Derived, far: number, sizeMul = 1): number {
  const frac = (rng.next() + rng.next()) / 2;
  const skew = Math.pow(frac, 1 / Math.max(0.4, d.size * (1 + 0.15 * far)));
  let cm = s.cm[0] + (s.cm[1] - s.cm[0]) * skew;
  if (d.size > 1) cm *= 1 + (d.size - 1) * 0.5;
  cm *= sizeMul;
  return Math.max(1, Math.round(cm * 10) / 10);
}

export function sizeFrac(s: Species, cm: number): number {
  return (cm - s.cm[0]) / Math.max(1, s.cm[1] - s.cm[0]);
}

/** 0 normal, 1 silver, 2 gold, 3 rainbow (only a perfect catch) */
export function rollQuality(rng: Rng, s: Species, cm: number, d: Derived, f: { perfect: boolean; perfectCast: boolean; bullseye: boolean }): number {
  if (s.tags.includes('junk')) return 0;
  const v = 0.45 * clamp(sizeFrac(s, cm), 0, 1.3) + (f.perfect ? 0.3 : 0) + (f.perfectCast ? 0.12 : 0) + (f.bullseye ? 0.08 : 0) + d.quality + rng.range(-0.05, 0.1);
  if (v >= 0.95 && f.perfect) return 3;
  if (v >= 0.7) return 2;
  if (v >= 0.42) return 1;
  return 0;
}

export { avgCm };
