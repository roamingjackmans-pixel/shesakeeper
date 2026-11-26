// The living backdrop for the menus: a real fishing hole with a bot angler casting into bubbles and reeling fish in,
// and every so often, out on the water, Her: a golden flash leaping clear.
import { Angler } from '../core/angler';
import { Bot } from '../core/bot';
import { buildHole } from '../core/run';
import { Rng } from '../core/rng';
import { emptyStats } from '../core/stats';
import type { AnglerLook } from '../core/types';
import { HoleWorld } from '../core/world';
import { onTick, setScene } from '../render/canvas';
import { LakeScene } from '../render/lake';
import { audio } from '../audio/audio';

let stop: (() => void) | null = null;
let current: LakeScene | null = null;

export function demoLake(opts: { seed?: number; look?: AnglerLook; leap?: boolean } = {}): LakeScene {
  stopDemo();
  const seed = opts.seed ?? 1234;
  const rng = new Rng(seed);
  let hole = buildHole(rng, 0, []);
  // the menus look best at dusk or dawn, on calm water
  hole = { ...hole, time: rng.pick(['dusk', 'dawn', 'dusk', 'night'] as const), weather: rng.pick(['clear', 'clear', 'cloudy'] as const), seconds: 1e9, legendAt: 1e9 };
  const world = new HoleWorld(hole, []);
  const stats = emptyStats();
  stats.barSize = 0.6;
  stats.castDist = 0.3;
  const a = new Angler({ x: 9, seed: seed + 7, stats, hole, mods: [], charms: [] });
  const bot = new Bot(seed + 3, 0.95);
  const scene = new LakeScene(hole);
  scene.demo = true;
  scene.world = world;
  const look: AnglerLook = opts.look ?? { hat: 0, hatColor: 0, jacket: 1, skin: 1, hair: 1 };
  scene.anglers = [{ id: 'demo', name: '', look, view: a.view(), local: false, color: '#ffcc33', pt: 0, lastPhase: '', shownCm: 0, lure: 'bobber' }];
  let leapT = 4;
  const off = onTick((dt) => {
    world.update(dt);
    const ev = a.update(dt, bot.input(a, world, dt), world);
    for (const e of ev) {
      if (e.k === 'claim') world.claim(e.id);
      if (e.k === 'land') scene.splash(e.x, e.z, 8);
      if (e.k === 'catch') scene.anglers[0]!.shownCm = e.c.cm;
    }
    scene.anglers[0]!.view = a.view();
    if (opts.leap !== false) {
      leapT -= dt;
      if (leapT <= 0) {
        leapT = 9 + Math.random() * 6;
        scene.leap(-12 + Math.random() * 10, 30 + Math.random() * 14, 'marlene', 3.4, Math.random() < 0.5 ? 1 : -1);
        audio.sfx('splash', 0.4);
      }
    }
  });
  setScene(scene);
  current = scene;
  stop = () => off();
  return scene;
}

export function stopDemo(): void {
  stop?.();
  stop = null;
  current = null;
}

export function demoScene(): LakeScene | null {
  return current;
}
