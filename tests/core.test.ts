import { describe, expect, it } from 'vitest';
import { Angler } from '../src/core/angler';
import { botHold, LaggedEye, newBar, stepBar, type BarParams } from '../src/core/catchbar';
import { CURSE_ALWAYS, ornamentPrice, rollOrnament, validOrnament } from '../src/core/ornament';
import { cleanProfile, newProfile, recordRun, TOP_RUNS, type HistoryRow } from '../src/core/profile';
import { Rng } from '../src/core/rng';
import { buildRun, dailyMods, dailyRun, holeResult, loadoutStats, weekOf } from '../src/core/run';
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
    expect(idle).toBeLessThanOrEqual(5);
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
  it('three 2.5-minute holes, each a different water and mission, goals sized for the hole', () => {
    for (let s = 0; s < 50; s++) {
      const r = buildRun(s, 'solo', []);
      expect(r.holes.length).toBe(3);
      expect(new Set(r.holes.map((h) => h.biome)).size).toBe(3);
      expect(new Set(r.holes.map((h) => h.mission.id)).size).toBeGreaterThanOrEqual(2);
      for (const h of r.holes) {
        expect(h.mission.goal).toBeGreaterThan(0);
        expect(h.mission.goal).toBeLessThanOrEqual(10);
        expect(h.mission.goalText).toMatch(new RegExp(`\\b${h.mission.goal}\\b`));
        expect(h.mission.mult).toBeGreaterThan(1);
        expect(h.seconds).toBe(150);
        expect(h.legendAt).toBeLessThan(h.seconds - 20);
      }
    }
    // Speed Fishing makes holes 2 minutes
    expect(buildRun(1, 'solo', ['speed']).holes.every((h) => h.seconds === 120)).toBe(true);
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
  it('a good player catches about ten fish in a 2.5-minute hole with starter gear', () => {
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
    expect(avg).toBeGreaterThan(6.5);
    expect(avg).toBeLessThan(20);
  });
});

describe('distance, movement, shoves', () => {
  it('half the species need a long cast: starter gear reaches about a quarter, a good rod about half', async () => {
    const { SPECIES } = await import('../src/data/fish');
    const real = SPECIES.filter((s) => !s.tags.includes('junk'));
    const share = (m: number) => real.filter((s) => s.dist <= m).length / real.length;
    expect(share(27)).toBeLessThan(0.35); // the bamboo pole
    expect(share(33)).toBeLessThan(0.5); // fiberglass
    expect(share(45)).toBeGreaterThan(0.6); // the surf caster
    expect(share(58)).toBe(1); // the longest cast there is
  });
  it('fish only bite when the bobber is far enough out', async () => {
    const { reachable } = await import('../src/core/fishpool');
    const { holePool } = await import('../src/core/fishpool');
    const pool = holePool('lake', 'day');
    expect(reachable(pool, 10).every((s) => s.dist <= 10)).toBe(true);
    expect(reachable(pool, 50).some((s) => s.dist > 40)).toBe(true);
    expect(reachable(pool, 0).length).toBeGreaterThan(0);
  });
  it('every movement style can be caught by a good player at medium difficulty with a decent bar', () => {
    for (const beh of ['mixed', 'dart', 'smooth', 'sinker', 'floater', 'wave', 'burst', 'jumpy', 'heavy', 'rush'] as const) {
      let won = 0;
      for (let i = 0; i < 20; i++) if (reel(50, 0.3, human(), 7000 + i, beh) === 'caught') won++;
      expect(won, beh).toBeGreaterThanOrEqual(16);
    }
  });
  it('a shove wobbles the catch bar and is softened by steadiness; walking stays in the lane', () => {
    const hole = buildRun(8, 'solo', []).holes[0]!;
    const base = loadoutStats({ ...STARTER, dash: [], charms: [] }, [], []);
    const steady = loadoutStats({ ...STARTER, lure: 'anchor', dash: [], charms: [] }, [], []);
    const a = new Angler({ x: 0, seed: 1, stats: base, hole, mods: [], charms: [], lane: [-5, 5] });
    const b = new Angler({ x: 0, seed: 1, stats: steady, hole, mods: [], charms: [], lane: [-5, 5] });
    expect(a.shoved(1, 0.25, 1)).toBeGreaterThan(b.shoved(1, 0.25, 1));
    const w = new HoleWorld(hole, []);
    for (let i = 0; i < 120; i++) a.update(DT, { held: false, pressed: false, released: false, cancel: false, aim: 0, move: 1 }, w);
    expect(a.x).toBeLessThanOrEqual(5);
    expect(a.x).toBeGreaterThan(4);
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

describe('high scores', () => {
  const run = (score: number, at: number, mode = 'solo', fish = 3): HistoryRow => ({ at, mode, score, holes: ['A', 'B', 'C'], fish, best: '20 cm Bluegill' });

  it('weeks start on Monday', () => {
    expect(weekOf('2026-11-26')).toBe('2026-11-23'); // a Thursday
    expect(weekOf('2026-11-23')).toBe('2026-11-23');
    expect(weekOf('2026-11-29')).toBe('2026-11-23'); // Sunday is the week's last day
    expect(weekOf('2026-11-30')).toBe('2026-11-30');
  });

  it('keeps the ten best runs, best first, and says where a run placed', () => {
    const p = newProfile();
    const scores = [500, 900, 100, 1200, 300, 800, 50, 700, 650, 400, 1000, 20];
    const places = scores.map((s, i) => recordRun(p, run(s, i + 1), '2026-11-23'));
    expect(p.top).toHaveLength(TOP_RUNS);
    expect(p.top.map((r) => r.score)).toEqual([...scores].sort((a, b) => b - a).slice(0, TOP_RUNS));
    expect(places[0]).toBe(1); // the first run is the best so far
    expect(places[3]).toBe(1); // 1200 beats everything
    expect(places[10]).toBe(2); // 1000: second to 1200
    expect(places[11]).toBe(0); // 20 doesn't make the top ten
    expect(p.history).toHaveLength(10);
    expect(p.history[0]!.score).toBe(20); // recent runs are newest first
    expect(recordRun(p, run(0, 99), '2026-11-23')).toBe(0); // a blank run never enters the table
  });

  it('tracks this week, resetting on a new week, and per-mode bests', () => {
    const p = newProfile();
    recordRun(p, run(600, 1), '2026-11-16');
    recordRun(p, run(400, 2, 'daily', 9), '2026-11-23');
    recordRun(p, run(300, 3, 'coop'), '2026-11-23');
    expect(p.week).toEqual({ start: '2026-11-23', best: 400, runs: 2 });
    expect(p.stats.bestDaily).toBe(400);
    expect(p.stats.bestCoop).toBe(300);
    expect(p.stats.mostFish).toBe(9);
  });

  it('survives the save round trip, and older saves start their table from recent runs', () => {
    const p = newProfile();
    for (let i = 0; i < 4; i++) recordRun(p, run(100 * (i + 1), i + 1, i === 2 ? 'daily' : 'solo'), '2026-11-23');
    const back = cleanProfile(JSON.parse(JSON.stringify(p)));
    expect(back.top).toEqual(p.top);
    expect(back.week).toEqual(p.week);
    const old = JSON.parse(JSON.stringify(p));
    delete old.top;
    delete old.week;
    delete old.stats.bestDaily;
    const migrated = cleanProfile(old);
    expect(migrated.top.map((r) => r.score)).toEqual([400, 300, 200, 100]);
    expect(migrated.stats.bestDaily).toBe(300);
    // junk rows are dropped, not trusted
    const junk = cleanProfile({ ...old, top: [{ score: 'lots' }, null, { score: 5e9, at: -4, mode: 7, holes: 'x' }] });
    expect(junk.top).toHaveLength(1);
    expect(junk.top[0]).toMatchObject({ at: 0, mode: 'solo', holes: [] });
  });
});
