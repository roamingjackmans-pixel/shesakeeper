// Dash ornaments: randomly rolled relics, Nightreign style. Up to three good perks, each with a value rolled in its
// range. Any good perk can drag a curse in with it; a strong roll (top third of its range) or a potent perk always
// does. A curse never touches the same family of stats as a good perk on the same ornament, so it can't simply cancel.
import { COMMON_TYPES, CURSE_BY_KEY, CURSES, GOOD_BY_KEY, GOOD_PERKS, ORN_TYPES, type OrnType, type PerkDef, type PerkKey, type Tier } from '../data/perks';
import { clamp, type Rng } from './rng';
import { describeAttract, describeStat, type StatBonus, type StatKey, type Tag } from './stats';

export interface Curse {
  k: PerkKey;
  v: number;
}

export interface Perk {
  k: PerkKey;
  v: number;
  /** 0..1: how high it rolled in its range */
  q: number;
  c?: Curse;
}

export type OrnSource = 'shop' | 'treasure' | 'marlene' | 'daily' | 'starter';

export interface Ornament {
  id: string;
  type: OrnType;
  tint: number;
  tier: Tier;
  name: string;
  perks: Perk[];
  src: OrnSource;
  at: number;
  /** kept: can't be sold by accident */
  fav?: boolean;
}

/** how strong a good perk always brings a curse (0..1 through its range) */
export const CURSE_ALWAYS = 0.65;

/** the chance a weaker perk brings a curse anyway */
export function curseChance(q: number): number {
  return 0.18 + 0.3 * q;
}

const COUNT_WEIGHTS: Record<OrnSource, [number, number, number]> = {
  shop: [50, 35, 15],
  treasure: [42, 38, 20],
  daily: [0, 60, 40],
  marlene: [0, 0, 1],
  starter: [1, 0, 0],
};

function roundPerk(def: PerkDef, v: number): number {
  if (def.int) return Math.round(v);
  const span = Math.abs(def.max - def.min);
  const step = span >= 2 ? 1 : span >= 0.2 ? 0.01 : 0.005;
  return Math.round(v / step) * step;
}

function groupOf(def: PerkDef | undefined): string {
  return def?.group ?? String(def?.k ?? '');
}

export function rollOrnament(rng: Rng, src: OrnSource, id: string, at = 0, opts: { count?: number; minQ?: number; type?: OrnType } = {}): Ornament {
  const w = COUNT_WEIGHTS[src];
  const count = opts.count ?? (rng.weighted([1, 2, 3], (n) => w[n - 1]!) as 1 | 2 | 3);
  const minQ = opts.minQ ?? (src === 'marlene' ? 0.6 : 0);
  const perks: Perk[] = [];
  const usedGroups = new Set<string>();
  const usedKeys = new Set<string>();
  for (let i = 0; i < count; i++) {
    const pool = GOOD_PERKS.filter((p) => !usedKeys.has(p.k) && !(p.group && usedGroups.has(p.group)));
    const def = rng.weighted(pool, (p) => p.w ?? 1);
    usedKeys.add(def.k);
    if (def.group) usedGroups.add(def.group);
    const q0 = def.min === def.max ? 1 : minQ + (1 - minQ) * rng.next();
    const v = roundPerk(def, def.min + (def.max - def.min) * q0);
    const q = def.min === def.max ? 1 : clamp((v - def.min) / (def.max - def.min), 0, 1);
    perks.push({ k: def.k, v, q });
  }
  // curses, after every good perk is known, so none of them hits a good perk's family
  const goodGroups = new Set(perks.map((p) => groupOf(GOOD_BY_KEY[p.k])));
  const goodKeys = new Set(perks.map((p) => p.k));
  const usedCurses = new Set<string>();
  for (const p of perks) {
    const def = GOOD_BY_KEY[p.k]!;
    const strong = def.potent || p.q >= CURSE_ALWAYS;
    if (!strong && !rng.chance(curseChance(p.q))) continue;
    const pool = CURSES.filter((c) => !usedCurses.has(c.k) && !goodKeys.has(c.k) && !goodGroups.has(groupOf(c)));
    if (!pool.length) continue;
    const cdef = rng.weighted(pool, (c) => c.w ?? 1);
    usedCurses.add(cdef.k);
    // a better roll tends to bring a nastier curse
    const sev = clamp(0.15 + 0.6 * p.q + 0.35 * rng.next() - 0.1, 0, 1);
    p.c = { k: cdef.k, v: roundPerk(cdef, cdef.min + (cdef.max - cdef.min) * sev) };
  }
  const type: OrnType = opts.type ?? (src === 'marlene' ? 'marlene' : rng.pick(COMMON_TYPES));
  const tint = rng.int(0, ORN_TYPES[type].tints.length - 1);
  const tier = tierFor(perks, src);
  const best = [...perks].sort((a, b) => b.q - a.q)[0]!;
  const word = GOOD_BY_KEY[best.k]?.word ?? 'Odd';
  return { id, type, tint, tier, name: `${word} ${ORN_TYPES[type].name}`, perks, src, at };
}

export function tierFor(perks: Perk[], src: OrnSource): Tier {
  if (src === 'marlene') return 'pearl';
  const avg = perks.reduce((s, p) => s + p.q, 0) / Math.max(1, perks.length);
  if (perks.length >= 3) return avg >= 0.7 ? 'gold' : 'silver';
  if (perks.length === 2) return avg >= 0.85 ? 'silver' : 'brass';
  return 'plastic';
}

export function perkBonus(k: PerkKey, v: number): StatBonus {
  if (k.startsWith('attract:')) return { attract: { [k.slice(8) as Tag]: v } };
  return { [k as StatKey]: v };
}

export function perkText(k: PerkKey, v: number): string {
  if (k.startsWith('attract:')) return describeAttract(k.slice(8) as Tag, v);
  return describeStat(k as StatKey, v);
}

/** the range text for a perk, e.g. "5–25%" (to show how good a roll was) */
export function perkRange(k: PerkKey, curse = false): string {
  const d = (curse ? CURSE_BY_KEY : GOOD_BY_KEY)[k];
  if (!d || d.min === d.max) return '';
  const pct = !d.int && Math.abs(d.max) <= 4;
  const f = (x: number) => (pct ? `${Math.round(Math.abs(x) * 100)}` : `${Math.abs(x)}`);
  return `${f(d.min)}–${f(d.max)}${pct ? '%' : ''}`;
}

export function ornamentBonuses(o: Ornament): StatBonus[] {
  const out: StatBonus[] = [];
  for (const p of o.perks) {
    out.push(perkBonus(p.k, p.v));
    if (p.c) out.push(perkBonus(p.c.k, p.c.v));
  }
  return out;
}

/** shop price: stronger perks cost more, a curse takes a fifth off */
export function ornamentPrice(o: Ornament): number {
  let v = 0;
  for (const p of o.perks) {
    const def = GOOD_BY_KEY[p.k];
    v += (150 + 450 * p.q) * (def?.potent ? 1.4 : 1);
  }
  if (o.perks.some((p) => p.c)) v *= 0.8;
  return Math.max(50, Math.round(v / 10) * 10);
}

export function ornamentSellValue(o: Ornament, sellBonus = 0): number {
  return Math.max(10, Math.round((ornamentPrice(o) * 0.35 * (1 + Math.max(-0.8, sellBonus))) / 5) * 5);
}

/** checks a saved ornament is sane (a save edited by hand, or from an older version) */
export function validOrnament(o: unknown): o is Ornament {
  if (!o || typeof o !== 'object') return false;
  const x = o as Ornament;
  if (typeof x.id !== 'string' || !(x.type in ORN_TYPES) || !Array.isArray(x.perks) || x.perks.length < 1 || x.perks.length > 3) return false;
  for (const p of x.perks) {
    const d = GOOD_BY_KEY[p?.k];
    if (!d || typeof p.v !== 'number' || !Number.isFinite(p.v)) return false;
    const lo = Math.min(d.min, d.max) - 1e-6;
    const hi = Math.max(d.min, d.max) + 1e-6;
    if (p.v < lo || p.v > hi) return false;
    if (p.c) {
      const cd = CURSE_BY_KEY[p.c.k];
      if (!cd || typeof p.c.v !== 'number' || p.c.v > 0) return false;
    }
  }
  return true;
}
