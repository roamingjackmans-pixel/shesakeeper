// Work done ahead of time while the browser is idle (after the garage appears): every fish picture, your ornaments,
// all the gear icons and the music's guitar notes. Opening the fish log, the glovebox or the shop is then instant
// instead of drawing and encoding dozens of pictures on the spot.
import { audio } from '../audio/audio';
import { ALL_FISH } from '../data/fish';
import { ALL_GEAR } from '../data/gear';
import { fishSprite } from '../render/fishart';
import { gearSprite } from '../render/gearart';
import { ornamentSprite } from '../render/ornart';
import { session } from '../session';

type Idle = (cb: (d: { timeRemaining(): number }) => void, o?: { timeout: number }) => number;
const idle: Idle = (window as unknown as { requestIdleCallback?: Idle }).requestIdleCallback ?? ((cb) => window.setTimeout(() => cb({ timeRemaining: () => 8 }), 60));

let started = false;

export function warmUp(): void {
  if (started) return;
  started = true;
  const p = session.profile;
  const jobs: (() => void)[] = [];
  for (const f of ALL_FISH) {
    jobs.push(() => fishSprite(f.id));
    if (!p.log[f.id]) jobs.push(() => fishSprite(f.id, true));
  }
  for (const g of ALL_GEAR) jobs.push(() => gearSprite(g.id));
  for (const o of p.ornaments) jobs.push(() => ornamentSprite(o));
  jobs.push(() => audio.warm());
  const step = (d: { timeRemaining(): number }): void => {
    // a few pictures per idle moment, never more than the browser says it can spare
    while (jobs.length && d.timeRemaining() > 6) jobs.shift()!();
    if (jobs.length) idle(step, { timeout: 2000 });
  };
  idle(step, { timeout: 2000 });
}
