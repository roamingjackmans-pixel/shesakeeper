// The save: what you own (gear, dash ornaments), what you last fished with, your fish log, records and settings.
// Signed in, it lives on Shoallhell's server (/api/sak/profile); offline, in this browser.
import { ALL_FISH } from '../data/fish';
import { GEAR, STARTER } from '../data/gear';
import { CHARM_SLOTS } from '../data/charms';
import { rollOrnament, validOrnament, type Ornament } from './ornament';
import { Rng } from './rng';
import type { AnglerLook, Catch, Loadout } from './types';

export const GLOVEBOX_MAX = 60;
export const DASH_SLOTS = 3;

export interface LogEntry {
  n: number;
  best: number;
  bestKg: number;
  at: number;
}

export interface HistoryRow {
  at: number;
  mode: string;
  score: number;
  holes: string[];
  rank?: number;
  players?: number;
}

export interface Settings {
  sfx: number;
  music: number;
  shake: boolean;
  hints: boolean;
}

export interface Profile {
  v: 1;
  owned: string[];
  ornaments: Ornament[];
  nextOrn: number;
  loadout: Loadout;
  log: Record<string, LogEntry>;
  stats: { runs: number; best: number; fish: number; marlene: number; dailies: number; total: number };
  daily: { date: string; best: number; reward: boolean };
  look: AnglerLook;
  settings: Settings;
  tips: string[];
  history: HistoryRow[];
}

export function newProfile(): Profile {
  const p: Profile = {
    v: 1,
    owned: [STARTER.rod, STARTER.lure, STARTER.bait],
    ornaments: [],
    nextOrn: 1,
    loadout: { ...STARTER, dash: [null, null, null], charms: [] },
    log: {},
    stats: { runs: 0, best: 0, fish: 0, marlene: 0, dailies: 0, total: 0 },
    daily: { date: '', best: 0, reward: false },
    look: { hat: 0, hatColor: 0, jacket: 0, skin: 1, hair: 0 },
    settings: { sfx: 0.8, music: 0.5, shake: true, hints: true },
    tips: [],
    history: [],
  };
  // a first ornament on the dash, so it never starts bare
  const o = rollOrnament(new Rng('starter'), 'starter', 'o0', Date.now(), { count: 1, type: 'bobble' });
  o.perks = [{ k: 'barSize', v: 0.1, q: 0.25 }];
  o.name = 'Lucky Angler Bobblehead';
  p.ornaments.push(o);
  p.loadout.dash[0] = o.id;
  return p;
}

const num = (v: unknown, d: number, lo = -Infinity, hi = Infinity): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

/** a profile from anything (an old save, a hand-edited one, nothing): always usable */
export function cleanProfile(raw: unknown): Profile {
  const base = newProfile();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<Profile>;
  const p = base;
  if (Array.isArray(r.owned)) p.owned = [...new Set([...p.owned, ...r.owned.filter((id) => typeof id === 'string' && GEAR[id])])];
  if (Array.isArray(r.ornaments)) {
    const seen = new Set<string>();
    p.ornaments = r.ornaments.filter((o) => validOrnament(o) && !seen.has(o.id) && (seen.add(o.id), true)).slice(0, GLOVEBOX_MAX);
  }
  p.nextOrn = num(r.nextOrn, 1, 1);
  for (const o of p.ornaments) {
    const n = Number(o.id.slice(1));
    if (Number.isFinite(n) && n >= p.nextOrn) p.nextOrn = n + 1;
  }
  const lo = r.loadout;
  if (lo && typeof lo === 'object') {
    for (const k of ['rod', 'lure', 'bait'] as const) if (typeof lo[k] === 'string' && p.owned.includes(lo[k]) && GEAR[lo[k]]?.kind === k) p.loadout[k] = lo[k];
    if (Array.isArray(lo.dash)) p.loadout.dash = [0, 1, 2].map((i) => {
      const id = lo.dash[i];
      return typeof id === 'string' && p.ornaments.some((o) => o.id === id) ? id : null;
    });
  } else if (!p.ornaments.some((o) => o.id === p.loadout.dash[0])) p.loadout.dash = [null, null, null];
  p.loadout.charms = [];
  if (r.log && typeof r.log === 'object') {
    for (const f of ALL_FISH) {
      const e = (r.log as Record<string, LogEntry>)[f.id];
      if (e && typeof e === 'object') p.log[f.id] = { n: num(e.n, 0, 0), best: num(e.best, 0, 0), bestKg: num(e.bestKg, 0, 0), at: num(e.at, 0, 0) };
    }
  }
  if (r.stats && typeof r.stats === 'object') for (const k of Object.keys(p.stats) as (keyof Profile['stats'])[]) p.stats[k] = num(r.stats[k], 0, 0);
  if (r.daily && typeof r.daily === 'object') p.daily = { date: typeof r.daily.date === 'string' ? r.daily.date : '', best: num(r.daily.best, 0, 0), reward: !!r.daily.reward };
  if (r.look && typeof r.look === 'object') for (const k of Object.keys(p.look) as (keyof AnglerLook)[]) p.look[k] = Math.floor(num(r.look[k], p.look[k], 0, 20));
  if (r.settings && typeof r.settings === 'object') {
    p.settings.sfx = num(r.settings.sfx, 0.8, 0, 1);
    p.settings.music = num(r.settings.music, 0.5, 0, 1);
    p.settings.shake = r.settings.shake !== false;
    p.settings.hints = r.settings.hints !== false;
  }
  if (Array.isArray(r.tips)) p.tips = r.tips.filter((t) => typeof t === 'string').slice(0, 50);
  if (Array.isArray(r.history)) p.history = r.history.filter((h) => h && typeof h === 'object' && typeof h.score === 'number').slice(0, 10);
  return p;
}

export function newOrnamentId(p: Profile): string {
  return `o${p.nextOrn++}`;
}

export function ornamentById(p: Profile, id: string | null | undefined): Ornament | undefined {
  return id ? p.ornaments.find((o) => o.id === id) : undefined;
}

/** a catch goes into the fish log; returns whether it was new or a record */
export function logCatch(p: Profile, c: Catch): { firstEver: boolean; record: boolean } {
  const e = p.log[c.id];
  p.stats.fish += 1;
  if (!e) {
    p.log[c.id] = { n: 1, best: c.cm, bestKg: c.kg, at: Date.now() };
    return { firstEver: true, record: false };
  }
  e.n += 1;
  const record = c.cm > e.best;
  if (record) {
    e.best = c.cm;
    e.bestKg = c.kg;
  }
  return { firstEver: false, record };
}

export function removeOrnament(p: Profile, id: string): void {
  p.ornaments = p.ornaments.filter((o) => o.id !== id);
  p.loadout.dash = p.loadout.dash.map((d) => (d === id ? null : d));
}

export function emptyCharms(): string[] {
  return new Array(CHARM_SLOTS).fill('').filter(Boolean);
}
