// The bait & tackle shop on the road (between holes) and on the way home (after the last). Gear you don't own yet
// (kept forever), freshly rolled dash ornaments, and run charms (only on the road: they last until the run ends).
// Rerolling costs cash and gets dearer each time, Balatro style; ornament perks can make some free.
import { CHARMS } from '../data/charms';
import { ALL_GEAR, GEAR } from '../data/gear';
import { ornamentPrice, rollOrnament, type Ornament } from './ornament';
import { clamp, type Rng } from './rng';
import type { Stats } from './stats';

export interface ShopItem {
  kind: 'gear' | 'ornament' | 'charm';
  id: string;
  orn?: Ornament;
  price: number;
  sold?: boolean;
}

export interface ShopState {
  items: ShopItem[];
  rerolls: number;
  freeLeft: number;
  /** charms are only sold on the road */
  home: boolean;
}

export function priceMul(st: Stats): number {
  return clamp(1 - st.shopDiscount, 0.4, 1.6);
}

/** rerolls are dear on purpose: $1,500, then double every time at the same stop (perks can take some off) */
export const REROLL_BASE = 1500;

export function rerollCost(n: number, st: Stats): number {
  return Math.max(0, Math.round((REROLL_BASE * Math.pow(2, n) * clamp(1 - st.rerollDiscount, 0.2, 2)) / 50) * 50);
}

/** gear the player could still buy (not owned, not an earned special) */
export function buyableGear(owned: string[]): string[] {
  return ALL_GEAR.filter((g) => !owned.includes(g.id) && !g.special && g.price > 0).map((g) => g.id);
}

export function rollItems(rng: Rng, o: { owned: string[]; charms: string[]; home: boolean; stats: Stats; ornId: () => string }): ShopItem[] {
  const mul = priceMul(o.stats);
  const items: ShopItem[] = [];
  const gearLeft = rng.shuffle(buyableGear(o.owned));
  const nGear = o.home ? 3 : 2;
  const nOrn = o.home ? 3 : 2;
  let orns = nOrn;
  for (let i = 0; i < nGear; i++) {
    const id = gearLeft[i];
    if (id) items.push({ kind: 'gear', id, price: Math.round((GEAR[id]!.price * mul) / 5) * 5 });
    else orns++;
  }
  for (let i = 0; i < orns; i++) {
    const orn = rollOrnament(rng, 'shop', o.ornId(), Date.now());
    items.push({ kind: 'ornament', id: orn.id, orn, price: Math.round((ornamentPrice(orn) * mul) / 5) * 5 });
  }
  if (!o.home) {
    const charmsLeft = rng.shuffle(CHARMS.filter((c) => !o.charms.includes(c.id)));
    for (const c of charmsLeft.slice(0, 2)) items.push({ kind: 'charm', id: c.id, price: Math.round((c.price * mul) / 5) * 5 });
  }
  return items;
}

export function newShop(rng: Rng, o: { owned: string[]; charms: string[]; home: boolean; stats: Stats; ornId: () => string }): ShopState {
  return { items: rollItems(rng, o), rerolls: 0, freeLeft: Math.max(0, Math.floor(o.stats.freeReroll)), home: o.home };
}
