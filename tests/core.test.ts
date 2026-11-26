import { describe, expect, it } from 'vitest';
import { Angler } from '../src/core/angler';
import { botHold, LaggedEye, newBar, stepBar, type BarParams } from '../src/core/catchbar';
import { CURSE_ALWAYS, ornamentPrice, rollOrnament, validOrnament } from '../src/core/ornament';
import { cleanProfile, newProfile } from '../src/core/profile';
import { Rng } from '../src/core/rng';
import { buildRun, dailyMods, dailyRun, holeResult, loadoutStats } from '../src/core/run';
import { newShop, rerollCost } from '../src/core/shop';
import { derived } from '../src/core/stats';
import { HoleWorld } from '../src/core/world';
import { CURSE_BY_KEY, GOOD_BY_KEY } from '../src/data/perks';
import { MOD } from '../src/data/charms';
import { STARTER } from '../src/data/gear';
import { FISH, MARLENE } from '../src/data/fish';
import { Bot } from '../src/core/bot';

const DT = 1 / 60;

/** a good human: 0.18 s reaction time */
const human = () => {
  const eye = new LaggedEye(11);
  return (s: ReturnType<typeof newBar>) => botHold(s, 1, eye.see(s));
};

function reel(diff: number, bar: number, held: (s: ReturnType<typeof newBar>) => boolean, seed: number, beh: BarParams['beh'] = 'mixed'): 'caught' | 'escaped' {
  const rng = new Rng(seed);
  const p: BarParams = { bar, fill: 0.15, drain: 0.17, fishSpeed: 1, bounce: 0.45, diff, beh, reverse: false, treasure: false };
  const s = newBar(rng, p);
  for (let i = 0; i < 60 * 120; i++) {
    const r = stepBar(s, p, rng, held(s), DT);
    if (r) return r;
  }
  return 'escaped';
}

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
    expect(new Rng('x').next()).not.toBe(new Rng('y').next());
  });
});

describe('the catch bar', () => {
  it('a good player lands easy and medium fish nearly every time with the starter bar', () => {
    const rates: string[] = [];
    for (const diff of [20, 45, 60]) {
      let won = 0;
      for (let i = 0; i < 40; i++) if (reel(diff, 0.22, human(), i * 7 + diff) === 'caught') won++;
      rates.push(`diff ${diff}: ${won}/40`);
      expect(won, `diff ${diff}`).toBeGreaterThanOrEqual(diff <= 45 ? 34 : 26);
    }
    console.log('starter bar, good human:', rates.join(', '));
  });
  it('hard fish need a bigger bar', () => {
    let small = 0;
    let big = 0;
    let legend = 0;
    for (let i = 0; i < 40; i++) {
      if (reel(88, 0.22, human(), 1000 + i, 'dart') === 'caught') small++;
      if (reel(88, 0.4, human(), 1000 + i, 'dart') === 'caught') big++;
      if (reel(96, 0.4, human(), 2000 + i, 'legend') === 'caught') legend++;
    }
    console.log(`diff 88 dart: bar 0.22 ${small}/40, bar 0.40 ${big}/40; Marlene with bar 0.40: ${legend}/40`);
    expect(big).toBeGreaterThan(small);
    expect(small).toBeLessThan(32);
    let starterLegend = 0;
    for (let i = 0; i < 40; i++) if (reel(96, 0.22, human(), 3000 + i, 'legend') === 'caught') starterLegend++;
    expect(starterLegend).toBeLessThanOrEqual(6);
  });
  it('doing nothing or mashing does not land medium fish', () => {
    let idle = 0;
    let mash = 0;
    for (let i = 0; i < 30; i++) {
      if (reel(50, 0.22, () => false, 500 + i) === 'caught') idle++;
      let k = 0;
      if (reel(50, 0.22, () => (k++ % 20) < 10, 900 + i) === 'caught') mash++;
    }
    expect(idle).toBeLessThanOrEqual(3);
    expect(mash).toBeLessThanOrEqual(8);
  });
});

describe('dash ornaments', () => {
  it('roll 1–3 good perks in range; strong rolls always bring a curse that never shares a family', () => {
    const rng = new Rng(7);
    let cursed = 0;
    let three = 0;
    for (let i = 0; i < 4000; i++) {
      const o = rollOrnament(rng, i % 3 === 0 ? 'treasure' : 'shop', `o${i}`);
      expect(validOrnament(o)).toBe(true);
      expect(o.perks.length).toBeGreaterThanOrEqual(1);
      expect(o.perks.length).toBeLessThanOrEqual(3);
      if (o.perks.length === 3) three++;
      const groups = o.perks.map((p) => GOOD_BY_KEY[p.k]!.group ?? p.k);
      expect(new Set(o.perks.map((p) => p.k)).size).toBe(o.perks.length);
      for (const p of o.perks) {
        const def = GOOD_BY_KEY[p.k]!;
        if (def.potent || p.q >= CURSE_ALWAYS) expect(p.c, `${p.k} q=${p.q}`).toBeTruthy();
        if (p.c) {
          cursed++;
          const cd = CURSE_BY_KEY[p.c.k]!;
          expect(p.c.v).toBeLessThan(0);
          expect(groups).not.toContain(cd.group ?? cd.k);
          expect(o.perks.map((x) => x.k)).not.toContain(p.c.k);
        }
      }
      expect(ornamentPrice(o)).toBeGreaterThan(0);
    }
    expect(cursed).toBeGreaterThan(1000);
    expect(three).toBeGreaterThan(300);
  });
  it('Marlene ornaments are pearl with three strong perks', () => {
    const o = rollOrnament(new Rng(3), 'marlene', 'm1');
    expect(o.tier).toBe('pearl');
    expect(o.perks.length).toBe(3);
    expect(o.type).toBe('marlene');
  });
});

describe('runs', () => {
  it('two holes, different water, missions with goals', () => {
    for (let s = 0; s < 50; s++) {
      const r = buildRun(s, 'solo', []);
      expect(r.holes.length).toBe(2);
      expect(r.holes[0]!.biome).not.toBe(r.holes[1]!.biome);
      for (const h of r.holes) {
        expect(h.mission.goal).toBeGreaterThan(0);
        expect(h.mission.mult).toBeGreaterThan(1);
        expect(h.seconds).toBe(240);
      }
    }
  });
  it('the daily is the same for everyone and has 2–3 compatible modifiers', () => {
    expect(dailyRun('2026-11-25')).toEqual(dailyRun('2026-11-25'));
    for (let d = 1; d <= 28; d++) {
      const date = `2026-02-${String(d).padStart(2, '0')}`;
      const m = dailyMods(date);
      expect(m.length).toBeGreaterThanOrEqual(2);
      for (const a of m) for (const b of m) if (a !== b) expect(MOD[a]!.excludes ?? []).not.toContain(b);
    }
  });
});

function playHole(seed: number, skill: number, lo = { ...STARTER, dash: [] as (string | null)[], charms: [] as string[] }, mods: string[] = []) {
  const run = buildRun(seed, 'solo', mods);
  const hole = run.holes[0]!;
  const stats = loadoutStats(lo, [], mods);
  const world = new HoleWorld(hole, mods);
  world.legendChance = derived(stats).legend;
  const a = new Angler({ x: 0, seed: seed + 1, stats, hole, mods, charms: lo.charms });
  const bot = new Bot(seed + 2, skill);
  let guard = 0;
  while (a.phase !== 'done' && guard++ < 60 * 400) {
    world.update(DT);
    const ev = a.update(DT, bot.input(a, world, DT), world);
    for (const e of ev) if (e.k === 'claim') world.claim(e.id);
  }
  return { a, res: holeResult(a.catches, hole, 0), hole };
}

describe('a whole hole, played by a bot', () => {
  it('a good player catches a dozen-plus fish in four minutes with starter gear', () => {
    const counts: number[] = [];
    const pts: number[] = [];
    for (let s = 1; s <= 12; s++) {
      const { a, res } = playHole(s * 101, 1);
      expect(a.phase).toBe('done');
      counts.push(a.catches.length);
      pts.push(res.total);
      for (const c of a.catches) expect(Number.isFinite(c.points) && c.points > 0).toBe(true);
    }
    const avg = counts.reduce((x, y) => x + y, 0) / counts.length;
    const avgPts = pts.reduce((x, y) => x + y, 0) / pts.length;
    console.log(`starter gear: ${avg.toFixed(1)} fish, ${Math.round(avgPts)} points per hole (min ${Math.min(...pts)}, max ${Math.max(...pts)})`);
    expect(avg).toBeGreaterThan(10);
    expect(avg).toBeLessThan(30);
  });
});

describe('regressions', () => {
  it('a hole ends even if the fish never leaves the bar after the whistle', () => {
    const hole = { ...buildRun(5, 'solo', []).holes[0]!, seconds: 5 };
    const stats = loadoutStats({ ...STARTER, dash: [], charms: [] }, [], []);
    const world = new HoleWorld(hole, []);
    const a = new Angler({ x: 0, seed: 9, stats, hole, mods: [], charms: [] });
    // hook something, then hold the bar exactly on the fish forever
    a.phase = 'bite' as typeof a.phase;
    a.fish = { sp: { ...FISH.bluegill!, diff: 0 }, cm: 20 };
    a.update(DT, { held: false, pressed: true, released: false, cancel: false, aim: 0 }, world);
    expect(a.phase).toBe('reeling');
    a.bar!.progress = 0.5;
    let t = 0;
    while (a.phase !== 'done' && t < 60) {
      world.update(DT);
      if (a.bar) {
        a.bar.barPos = Math.max(0, Math.min(1 - a.bar.bar, a.bar.fishPos - a.bar.bar / 2));
        a.bar.progress = 0.5;
      }
      a.update(DT, { held: false, pressed: false, released: false, cancel: false, aim: 0 }, world);
      t += DT;
    }
    expect(a.phase).toBe('done');
    expect(t).toBeLessThan(35);
  });

  it('forfeiting Her (another angler hooked her first) clears the line', () => {
    const hole = buildRun(6, 'solo', []).holes[0]!;
    const stats = loadoutStats({ ...STARTER, dash: [], charms: [] }, [], []);
    const a = new Angler({ x: 0, seed: 3, stats, hole, mods: [], charms: [] });
    expect(a.forfeitLegend()).toBe(false);
    a.phase = 'reeling' as typeof a.phase;
    a.fish = { sp: MARLENE, cm: 250 };
    expect(a.forfeitLegend()).toBe(true);
    expect(a.fish).toBe(null);
    expect(a.phase).toBe('reelin');
  });
});

describe('profile and shop', () => {
  it('a broken save becomes a usable profile', () => {
    expect(cleanProfile(null).owned).toContain('bamboo');
    const p = cleanProfile({ owned: ['bamboo', 'carbon', 'nope'], ornaments: [{ id: 'x' }], loadout: { rod: 'carbon', dash: ['zz'] }, stats: { runs: 'many' } });
    expect(p.owned).toContain('carbon');
    expect(p.owned).not.toContain('nope');
    expect(p.loadout.rod).toBe('carbon');
    expect(p.stats.runs).toBe(0);
    expect(p.ornaments.every((o) => validOrnament(o))).toBe(true);
  });
  it('the shop never sells owned gear; rerolls get dearer', () => {
    const p = newProfile();
    let n = 0;
    const s = newShop(new Rng(1), { owned: p.owned, charms: [], home: false, stats: loadoutStats(p.loadout, p.ornaments, []), ornId: () => `t${n++}` });
    expect(s.items.length).toBe(6);
    for (const it of s.items) if (it.kind === 'gear') expect(p.owned).not.toContain(it.id);
    const st = loadoutStats(p.loadout, p.ornaments, []);
    expect(rerollCost(1, st)).toBeGreaterThan(rerollCost(0, st));
  });
});
