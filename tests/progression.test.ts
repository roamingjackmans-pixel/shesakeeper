// Progression: a strong player (bot skill 0.85) starts from a fresh save and plays whole runs with the real rules:
// fishes every hole with their best gear, buys at every shop (gear first, then ornaments that beat what's on the dash),
// never rerolls. Unlocking every piece of gear must take at least 50 runs (owner's rule, 2026-11-26).
// `npm run balance` prints the curve.
import { describe, expect, it } from 'vitest';
import { Angler } from '../src/core/angler';
import { Bot } from '../src/core/bot';
import { type Ornament } from '../src/core/ornament';
import { hash, Rng } from '../src/core/rng';
import { buildRun, holeResult, loadoutStats } from '../src/core/run';
import { buyableGear, newShop } from '../src/core/shop';
import { derived } from '../src/core/stats';
import type { Loadout } from '../src/core/types';
import { HoleWorld } from '../src/core/world';
import { GEAR, type GearKind } from '../src/data/gear';

const DT = 1 / 20;

/** the player's pick: the rod that reaches furthest (the big fish live out there), the dearest lure and bait */
function bestOf(owned: Set<string>, kind: GearKind): string {
  const reach = (id: string) => (kind === 'rod' ? (GEAR[id]!.bonus.castDist ?? 0) * 10000 : 0);
  return [...owned].filter((id) => GEAR[id]?.kind === kind).sort((a, b) => reach(b) - reach(a) || GEAR[b]!.price - GEAR[a]!.price)[0]!;
}

function ornScore(o: Ornament): number {
  return o.perks.reduce((s, p) => s + 0.4 + p.q - (p.c ? 0.35 : 0), 0);
}

export function progression(seed: number, skill = 0.85, maxRuns = 140) {
  const owned = new Set(['bamboo', 'bobber', 'worms']);
  const orns: Ornament[] = [];
  let n = 0;
  const curve: { run: number; earned: number; owned: number }[] = [];
  let runs = 0;
  while (buyableGear([...owned]).length && runs < maxRuns) {
    runs++;
    const cfg = buildRun(hash(`${seed}:run:${runs}`), 'solo', []);
    const dash = [...orns].sort((a, b) => ornScore(b) - ornScore(a)).slice(0, 3);
    const lo: Loadout = { rod: bestOf(owned, 'rod'), lure: bestOf(owned, 'lure'), bait: bestOf(owned, 'bait'), dash: dash.map((o) => o.id), charms: [] };
    const stats = loadoutStats(lo, orns, []);
    let cash = Math.max(0, stats.startCash);
    let earned = 0;
    for (const hole of cfg.holes) {
      const st = loadoutStats({ ...lo, rod: bestOf(owned, 'rod'), lure: bestOf(owned, 'lure'), bait: bestOf(owned, 'bait') }, orns, []);
      const world = new HoleWorld(hole, []);
      world.legendChance = derived(st).legend;
      const a = new Angler({ x: 0, seed: hole.seed + runs, stats: st, hole, mods: [], charms: [] });
      const bot = new Bot(hole.seed ^ 7, skill);
      let treasure = 0;
      for (let guard = 0; a.phase !== 'done' && guard < 20 * 300; guard++) {
        world.update(DT);
        for (const e of a.update(DT, bot.input(a, world, DT), world)) {
          if (e.k === 'claim') world.claim(e.id);
          if (e.k === 'treasure' && e.reward.kind === 'cash') treasure += e.reward.amount;
          if ((e.k === 'escape' || e.k === 'miss') && e.legend) world.legendGone();
        }
      }
      const res = holeResult(a.catches, hole, treasure);
      cash += res.total + treasure;
      earned += res.total + treasure;
      // the shop after this hole: gear first (dearest you can afford), then an ornament that beats your dash
      const home = hole.idx === cfg.holes.length - 1;
      const shop = newShop(new Rng(hash(`${seed}:${runs}:${hole.idx}`)), { owned: [...owned], charms: [], home, stats: st, ornId: () => `o${n++}` });
      for (const it of [...shop.items].filter((x) => x.kind === 'gear').sort((x, y) => y.price - x.price)) {
        if (it.price <= cash) {
          cash -= it.price;
          owned.add(it.id);
        }
      }
      const worst = Math.min(...[...orns].sort((x, y) => ornScore(y) - ornScore(x)).slice(0, 3).map(ornScore), orns.length < 3 ? -1 : Infinity);
      for (const it of shop.items.filter((x) => x.kind === 'ornament' && x.orn && ornScore(x.orn) > worst)) {
        if (it.price <= cash) {
          cash -= it.price;
          orns.push(it.orn!);
        }
      }
    }
    if (runs % 5 === 0 || !buyableGear([...owned]).length) curve.push({ run: runs, earned: Math.round(earned), owned: owned.size });
  }
  return { runs, done: !buyableGear([...owned]).length, curve, ornaments: orns.length };
}

describe('progression', () => {
  it('unlocking every piece of gear takes a strong player at least 50 runs', () => {
    const results = [101, 202, 303].map((s) => progression(s));
    for (const r of results) console.log(`runs ${r.runs}${r.done ? '' : ' (not finished)'}, ornaments bought ${r.ornaments}: ${r.curve.map((c) => `#${c.run} $${c.earned} ${c.owned}/36`).join('  ')}`);
    for (const r of results) expect(r.runs).toBeGreaterThanOrEqual(50);
    // and it can be finished: nothing is priced out of reach of a single run
    expect(results.filter((r) => r.done).length).toBeGreaterThanOrEqual(2);
  }, 120000);
});
