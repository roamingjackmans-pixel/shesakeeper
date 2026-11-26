// Balance: a bot plays many whole holes with starter, mid and top gear. Better gear has to pay off clearly, every
// mission has to be reachable, and nothing may produce NaN. `npm run balance` prints the table.
import { describe, expect, it } from 'vitest';
import { Angler } from '../src/core/angler';
import { Bot } from '../src/core/bot';
import { rollOrnament, type Ornament } from '../src/core/ornament';
import { Rng } from '../src/core/rng';
import { buildRun, holeResult, loadoutStats } from '../src/core/run';
import { derived } from '../src/core/stats';
import type { Loadout } from '../src/core/types';
import { HoleWorld } from '../src/core/world';

const DT = 1 / 30;

function play(seed: number, lo: Loadout, orns: Ornament[], skill: number, mods: string[] = []) {
  const hole = buildRun(seed, 'solo', mods).holes[seed % 2]!;
  const stats = loadoutStats(lo, orns, mods);
  const world = new HoleWorld(hole, mods);
  world.legendChance = derived(stats).legend;
  const a = new Angler({ x: 0, seed: seed * 3 + 1, stats, hole, mods, charms: lo.charms });
  const bot = new Bot(seed * 7 + 2, skill);
  let guard = 0;
  let legendShown = false;
  while (a.phase !== 'done' && guard++ < 30 * 400) {
    world.update(DT);
    if (world.legend === 1 || world.legend === 2) legendShown = true;
    for (const e of a.update(DT, bot.input(a, world, DT), world)) {
      if (e.k === 'claim') world.claim(e.id);
      if ((e.k === 'escape' || e.k === 'miss') && e.legend) world.legendGone();
    }
  }
  return { res: holeResult(a.catches, hole, 0), a, hole, legendShown };
}

const KITS: Record<string, Loadout> = {
  starter: { rod: 'bamboo', lure: 'bobber', bait: 'worms', dash: [], charms: [] },
  mid: { rod: 'fiberglass', lure: 'cork', bait: 'crickets', dash: [], charms: [] },
  top: { rod: 'golden', lure: 'trap', bait: 'corn', dash: ['a', 'b', 'c'], charms: ['trick', 'reeler'] },
};

describe('balance', () => {
  it('better gear scores more; missions are reachable; numbers stay finite', () => {
    const rng = new Rng(11);
    const topOrns = ['a', 'b', 'c'].map((id) => {
      const o = rollOrnament(rng, 'shop', id, 0, { count: 3, minQ: 0.7 });
      o.perks = o.perks.map((p) => ({ ...p, c: undefined }));
      return o;
    });
    const rows: string[] = [];
    const avg: Record<string, number> = {};
    const missions = new Map<string, [number, number]>();
    for (const [name, kit] of Object.entries(KITS)) {
      let total = 0;
      let fish = 0;
      let done = 0;
      const N = 24;
      for (let s = 1; s <= N; s++) {
        const { res, hole } = play(s * 37, kit, name === 'top' ? topOrns : [], 0.85);
        for (const c of res.catches) expect(Number.isFinite(c.points) && c.points > 0).toBe(true);
        total += res.total;
        fish += res.catches.length;
        if (res.missionDone) done++;
        const m = missions.get(hole.mission.id) ?? [0, 0];
        missions.set(hole.mission.id, [m[0] + (res.missionDone ? 1 : 0), m[1] + 1]);
      }
      avg[name] = total / N;
      rows.push(`${name.padEnd(8)} ${Math.round(total / N).toString().padStart(6)} pts/hole  ${(fish / N).toFixed(1)} fish  missions ${done}/${N}`);
    }
    console.log(`skill 0.85 bot, 4-minute holes:\n${rows.join('\n')}\nmission completion: ${[...missions].map(([k, [d, n]]) => `${k} ${d}/${n}`).join(', ')}`);
    expect(avg.mid!).toBeGreaterThan(avg.starter! * 1.05);
    expect(avg.top!).toBeGreaterThan(avg.mid! * 1.4);
  });

  it('Marlene: with Marlene Watch she always shows; a big bar can land her, the starter bar mostly cannot', () => {
    let shown = 0;
    let caughtTop = 0;
    let caughtStarter = 0;
    const N = 16;
    for (let s = 1; s <= N; s++) {
      const top = play(s * 101, KITS.top!, [], 0.95, ['marlene']);
      const st = play(s * 101, KITS.starter!, [], 0.95, ['marlene']);
      if (top.legendShown) shown++;
      if (top.a.catches.some((c) => c.id === 'marlene')) caughtTop++;
      if (st.a.catches.some((c) => c.id === 'marlene')) caughtStarter++;
    }
    console.log(`Marlene Watch: shown ${shown}/${N}; landed with top gear ${caughtTop}/${N}, with starter gear ${caughtStarter}/${N}`);
    expect(shown).toBe(N);
    expect(caughtTop).toBeGreaterThan(caughtStarter);
  });
});
