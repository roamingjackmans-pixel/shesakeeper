// A test angler: aims at the best bubble it can reach, times its cast release, hooks after a human-ish delay and
// steers the catch bar. Skill 1 is a good player; lower skill misses timing more.
import { Angler, type AnglerInput } from './angler';
import { botHold, LaggedEye } from './catchbar';
import { Rng } from './rng';
import { BASE } from './stats';
import type { HoleWorld } from './world';

export class Bot {
  private rng: Rng;
  private target: { power: number; aim: number } | null = null;
  private wait = 0;
  private eye = new LaggedEye(11);
  constructor(
    seed: number,
    public skill = 1,
  ) {
    this.rng = new Rng(seed);
  }

  input(a: Angler, w: HoleWorld, dt: number): AnglerInput {
    const inp: AnglerInput = { held: false, pressed: false, released: false, cancel: false, aim: a.aim };
    switch (a.phase) {
      case 'ready': {
        this.wait -= dt;
        if (this.wait > 0) break;
        const reach = a.reach;
        const bubbles = w.bubbles.filter((b) => Math.hypot(b.x - a.x, b.z) <= reach * 0.98 && b.z > 4);
        // Her ripple first, then the furthest bubble, but only one out where the good fish are (a near bubble just
        // brings small fry); otherwise a long cast
        bubbles.sort((p, q) => Number(!!q.legend) - Number(!!p.legend) || q.z - p.z);
        const b = bubbles.find((x) => x.legend || x.z >= reach * 0.62);
        if (b) {
          const aim = Math.atan2(b.x - a.x, b.z);
          const dist = Math.hypot(b.x - a.x, b.z);
          this.target = { aim, power: (dist - BASE.castMin) / (reach - BASE.castMin) };
        } else this.target = { aim: this.rng.range(-0.35, 0.35), power: this.rng.range(0.85, 1) };
        inp.aim = this.target.aim;
        inp.pressed = true;
        inp.held = true;
        break;
      }
      case 'charging': {
        inp.aim = this.target?.aim ?? 0;
        const err = (1 - this.skill) * 0.25 * this.rng.gauss();
        const want = Math.min(1, Math.max(0, (this.target?.power ?? 0.8) + err));
        inp.held = !(Math.abs(a.power - want) < 0.035 || (want > 0.97 && a.power > 0.96));
        inp.released = !inp.held;
        break;
      }
      case 'bite':
        inp.pressed = this.rng.chance(dt / (0.2 + (1 - this.skill) * 0.6));
        break;
      case 'reeling':
        if (a.bar && a.bar.t < 0.02) this.eye = new LaggedEye(Math.round(11 + (1 - this.skill) * 10));
        inp.held = a.bar ? botHold(a.bar, this.skill, this.eye.see(a.bar)) : false;
        if (this.skill < 1 && this.rng.chance(0.08 * (1 - this.skill))) inp.held = !inp.held;
        break;
      case 'landing':
        this.wait = 0.2;
        break;
      default:
        break;
    }
    return inp;
  }
}
