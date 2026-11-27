// A run: three fishing holes, two and a half minutes each. Drive to a hole, pick gear for its mission, fish, shop on
// the road; twice more, the last shop on the way home. Score is every point you caught (spending never lowers it);
// cash is what you have left to spend this run.
import { CHARM, MOD, MODS, modFlags } from '../data/charms';
import { GEAR } from '../data/gear';
import { BIOME_IDS, BIOMES, TIMES } from '../data/spots';
import type { Biome, TimeOfDay, Weather } from '../data/fish';
import { holePool } from './fishpool';
import { makeMission, MISSION_BONUS } from './mission';
import { ornamentBonuses, type Ornament } from './ornament';
import { hash, Rng } from './rng';
import { addStats, BASE, emptyStats, type Stats } from './stats';
import type { ShopState } from './shop';
import type { Catch, HoleResult, HoleSpec, Loadout, RunConfig } from './types';

export const HOLES_PER_RUN = 3;

/** `avoid`: the water and missions already used this run (every hole is a different kind of water and mission) */
export function buildHole(rng: Rng, idx: number, mods: string[], avoid: { biomes?: Biome[]; missions?: string[] } = {}): HoleSpec {
  const flags = modFlags(mods);
  const biome = rng.pick(BIOME_IDS.filter((b) => !avoid.biomes?.includes(b)));
  const def = BIOMES[biome];
  const time: TimeOfDay = flags.time ?? rng.weighted(TIMES, (t) => (t === 'day' ? 1.3 : 1));
  const weather: Weather = flags.weather ?? rng.pick(def.weather);
  const pool = holePool(biome, time);
  const seconds = flags.holeSeconds ?? BASE.holeSeconds;
  const mission = makeMission(rng, { pool, time, weather, secs: seconds }, avoid.missions ?? []);
  return {
    idx,
    seed: Math.floor(rng.next() * 2 ** 31),
    biome,
    name: rng.pick(def.names),
    time,
    weather,
    mission,
    seconds,
    legendRoll: rng.next(),
    legendAt: rng.range(Math.min(40, seconds * 0.3), seconds - 50),
    wind: (rng.chance(0.5) ? 1 : -1) * rng.range(0.4, 1),
  };
}

export function buildRun(seed: number, mode: RunConfig['mode'], mods: string[], date?: string): RunConfig {
  const rng = new Rng(seed);
  const holes: HoleSpec[] = [];
  for (let i = 0; i < HOLES_PER_RUN; i++) holes.push(buildHole(rng, i, mods, { biomes: holes.map((x) => x.biome), missions: holes.map((x) => x.mission.id) }));
  return { seed, mode, mods: [...mods], holes, ...(date ? { date } : {}) };
}

/** today in US Central, like FlashGames and Baker's Dozen: YYYY-MM-DD */
export function today(now = new Date()): string {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' });
  return f.format(now);
}

export function dailyMods(date: string): string[] {
  const rng = new Rng(`sak-daily-mods:${date}`);
  const out: string[] = [];
  const n = rng.chance(0.5) ? 3 : 2;
  for (let tries = 0; out.length < n && tries < 50; tries++) {
    const m = rng.pick(MODS);
    if (out.includes(m.id)) continue;
    if (out.some((o) => MOD[o]?.excludes?.includes(m.id) || m.excludes?.includes(o))) continue;
    out.push(m.id);
  }
  return out;
}

export function dailyRun(date: string): RunConfig {
  return buildRun(hash(`sak-daily:${date}`), 'daily', dailyMods(date), date);
}

/** every stat for one angler at one hole */
export function loadoutStats(lo: Loadout, ornaments: Ornament[], mods: string[]): Stats {
  const s = emptyStats();
  for (const id of [lo.rod, lo.lure, lo.bait]) addStats(s, GEAR[id]?.bonus);
  for (const oid of lo.dash) {
    const o = oid ? ornaments.find((x) => x.id === oid) : undefined;
    if (o) for (const b of ornamentBonuses(o)) addStats(s, b);
  }
  for (const c of lo.charms) addStats(s, CHARM[c]?.bonus);
  for (const m of mods) addStats(s, MOD[m]?.bonus);
  return s;
}

export function holeResult(catches: Catch[], spec: HoleSpec, treasureCash: number): HoleResult {
  const points = catches.reduce((s, c) => s + c.points, 0);
  const matched = catches.filter((c) => c.mission).length;
  const missionDone = matched >= spec.mission.goal;
  return { points, catches, missionDone, total: missionDone ? Math.round(points * MISSION_BONUS) : points, treasureCash, marlene: catches.some((c) => c.id === 'marlene') };
}

export function missionProgress(catches: Catch[]): number {
  return catches.filter((c) => c.mission).length;
}

// ------------------------------------------------------------------ the run as it goes (plain JSON)

export type RunPhase = 'drive' | 'loadout' | 'fish' | 'tally' | 'shop' | 'results';

export interface RunState {
  cfg: RunConfig;
  phase: RunPhase;
  hole: number;
  score: number;
  cash: number;
  /** run charms owned (bought or found); `loadout.charms` are the ones switched on */
  charms: string[];
  loadout: Loadout;
  results: HoleResult[];
  /** ornament ids found or bought this run */
  found: string[];
  /** which shop stop (0 on the road, 1 on the way home) */
  shopVisit: number;
  /** the shop at the current stop (kept, so a refresh finds it as it was) */
  shop?: ShopState & { visit: number };
  /** catches so far in the hole being fished (kept, so a refresh mid-hole keeps them) */
  partial?: { hole: number; catches: Catch[]; treasureCash: number };
}

export function newRunState(cfg: RunConfig, loadout: Loadout, startCash: number): RunState {
  return { cfg, phase: 'drive', hole: 0, score: 0, cash: Math.max(0, Math.round(startCash)), charms: [], loadout: { ...loadout, dash: [...loadout.dash], charms: [] }, results: [], found: [], shopVisit: 0 };
}

/** what the phase after this one is */
export function nextPhase(r: RunState): { phase: RunPhase; hole: number; shopVisit: number } {
  switch (r.phase) {
    case 'drive':
      return { phase: 'loadout', hole: r.hole, shopVisit: r.shopVisit };
    case 'loadout':
      return { phase: 'fish', hole: r.hole, shopVisit: r.shopVisit };
    case 'fish':
      return { phase: 'tally', hole: r.hole, shopVisit: r.shopVisit };
    case 'tally':
      return { phase: 'shop', hole: r.hole, shopVisit: r.hole };
    case 'shop':
      return r.hole + 1 < r.cfg.holes.length ? { phase: 'drive', hole: r.hole + 1, shopVisit: r.shopVisit } : { phase: 'results', hole: r.hole, shopVisit: r.shopVisit };
    case 'results':
      return { phase: 'results', hole: r.hole, shopVisit: r.shopVisit };
  }
}

export function isHomeShop(r: RunState): boolean {
  return r.hole + 1 >= r.cfg.holes.length;
}
