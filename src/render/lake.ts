// The fishing hole on screen: a perspective water plane (x sideways, z out from the shore, in metres) under a sky
// for the time of day and weather, the far bank for the kind of water, the shore the anglers stand on, and everything
// that moves: shimmer, bubble spots, Her golden ripple, ripples and splashes, bobbers and lines, the anglers, rain,
// snow, fog and lightning. Static parts are drawn once into a layer per hole; each frame adds only what moves.
import type { AnglerView } from '../core/angler';
import { Rng, clamp } from '../core/rng';
import type { AnglerLook, HoleSpec } from '../core/types';
import type { HoleWorld } from '../core/world';
import { BIOMES, type BiomeDef } from '../data/spots';
import { alpha, mix, shade, skyFor, type SkyPal } from './color';
import { drawAngler, type Pose } from './anglerart';
import { layer, pixelRatio, type Scene } from './canvas';
import { drawFish, INK } from './fishart';
import { FISH } from '../data/fish';

export const HORIZON = 300;
export const SHORE_Y = 760;
export const Z0 = 16;
export const PX = 20;
export const CX = 800;
export const STAND_Z = -2.2;
export const W = 1600;
export const H = 900;
/** seconds a landed fish takes to fly from the water to the angler's hands */
const ARC_TIME = 0.45;

export function project(x: number, z: number): { x: number; y: number; s: number } {
  const s = Z0 / (z + Z0);
  return { x: CX + x * PX * s, y: HORIZON + (SHORE_Y - HORIZON) * s, s };
}

export function unproject(sx: number, sy: number): { x: number; z: number } {
  const yy = clamp(sy, HORIZON + 8, SHORE_Y - 4);
  const s = (yy - HORIZON) / (SHORE_Y - HORIZON);
  return { x: (sx - CX) / (PX * s), z: Z0 / s - Z0 };
}

/** vertical screen radius of a circle of world radius r lying on the water at depth z */
export function flatR(z: number, r: number): number {
  return ((SHORE_Y - HORIZON) * Z0 * r) / ((z + Z0) * (z + Z0));
}

export interface LakeAngler {
  id: string;
  name: string;
  look: AnglerLook;
  view: AnglerView;
  local: boolean;
  color: string;
  /** seconds in the current pose (kept by the scene) */
  pt: number;
  lastPhase: string;
  shownCm: number;
  lure: string;
  /** where the bobber was on screen while reeling (the catch flies from there) */
  lastB?: { x: number; y: number; bx: number; bz: number };
}

interface Ripple {
  x: number;
  z: number;
  t0: number;
  r: number;
  gold?: boolean;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  t: number;
  color: string;
  size: number;
}
interface Floater {
  text: string;
  x: number;
  y: number;
  t: number;
  color: string;
  size: number;
}

function poseFor(phase: string): Pose {
  switch (phase) {
    case 'charging':
      return 'charge';
    case 'flying':
      return 'cast';
    case 'waiting':
      return 'wait';
    case 'bite':
      return 'bite';
    case 'reeling':
      return 'reel';
    case 'landing':
      return 'hold';
    case 'done':
      return 'done';
    default:
      return 'idle';
  }
}

export class LakeScene implements Scene {
  spec: HoleSpec;
  biome: BiomeDef;
  sky: SkyPal;
  world: HoleWorld | null = null;
  anglers: LakeAngler[] = [];
  /** the local angler's aim guide */
  guide: { x: number; aim: number; reach: number; charging: boolean; power: number; landX: number; landZ: number; inBubble: boolean } | null = null;
  /** extra drawing on top (the reel panel, the cast meter) */
  overlay: ((c: CanvasRenderingContext2D, now: number) => void) | null = null;
  shake = 0;
  private bg: HTMLCanvasElement | null = null;
  private clouds: { img: HTMLCanvasElement; x: number; y: number; v: number }[] = [];
  private fog: HTMLCanvasElement | null = null;
  private glowSprite: HTMLCanvasElement | null = null;
  private shimmer: { x: number; z: number; ph: number; sp: number; w: number; sun: boolean }[] = [];
  private ripples: Ripple[] = [];
  private parts: Particle[] = [];
  private floaters: Floater[] = [];
  private rain: { x: number; y: number; v: number; l: number }[] = [];
  private flakes: { x: number; y: number; v: number; ph: number; r: number }[] = [];
  private flies: { x: number; y: number; ph: number }[] = [];
  private shadows: { x: number; z: number; a: number; v: number; len: number }[] = [];
  private dyn: { kind: 'buoy' | 'duck'; x: number; z: number; ph: number; vx: number }[] = [];
  private lastFlash = -99;
  private flashA = 0;
  private time = 0;
  private wind = 0;
  /** a calmer scene for menus (no guide, fewer effects) */
  demo = false;

  constructor(spec: HoleSpec) {
    this.spec = spec;
    this.biome = BIOMES[spec.biome];
    this.sky = skyFor(spec.time, spec.weather);
    const r = new Rng(spec.seed ^ 0x77);
    for (let i = 0; i < 120; i++) this.shimmer.push({ x: r.range(-70, 70), z: r.range(0.5, 62), ph: r.range(0, 6.28), sp: r.range(0.6, 1.8), w: r.range(6, 26), sun: false });
    if (spec.time !== 'night' || spec.weather === 'clear') {
      const sunWorldX = (this.sky.sunX - CX) / (PX * 0.22);
      for (let i = 0; i < 46; i++) this.shimmer.push({ x: sunWorldX + r.gauss() * 4, z: r.range(8, 62), ph: r.range(0, 6.28), sp: r.range(1, 2.4), w: r.range(10, 30), sun: true });
    }
    for (let i = 0; i < 4; i++) this.shadows.push({ x: r.range(-30, 30), z: r.range(6, 40), a: r.range(0, 6.28), v: r.range(0.6, 1.6), len: r.range(1.2, 2.6) });
    if (spec.weather === 'rain' || spec.weather === 'storm') for (let i = 0; i < 230; i++) this.rain.push({ x: r.range(0, W), y: r.range(0, H), v: r.range(900, 1300), l: r.range(14, 26) });
    if (spec.weather === 'snow') for (let i = 0; i < 150; i++) this.flakes.push({ x: r.range(0, W), y: r.range(0, H), v: r.range(30, 70), ph: r.range(0, 6.28), r: r.range(1.5, 3.5) });
    if (spec.time === 'night' || spec.time === 'dusk') if (['pond', 'swamp', 'lake', 'river'].includes(spec.biome)) for (let i = 0; i < 22; i++) this.flies.push({ x: r.range(40, W - 40), y: r.range(560, 790), ph: r.range(0, 6.28) });
    for (const p of this.biome.props)
      if (p === 'buoy' || p === 'duck') this.dyn.push({ kind: p, x: r.chance(0.5) ? r.range(-34, -20) : r.range(20, 34), z: r.range(14, 40), ph: r.range(0, 6.28), vx: p === 'duck' ? r.range(-0.5, 0.5) : 0 });
    this.wind = spec.wind;
  }

  resize(): void {
    this.bg = null;
    this.clouds = [];
    this.fog = null;
    this.glowSprite = null;
  }

  // ------------------------------------------------------------------ events from the game

  ripple(x: number, z: number, r = 2, gold = false): void {
    this.ripples.push({ x, z, t0: this.time, r, gold });
  }

  splash(x: number, z: number, n = 14, color = '#e8f6ff'): void {
    const p = project(x, z);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const sp = (90 + Math.random() * 160) * p.s;
      this.parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.4, t: 0, color, size: (2 + Math.random() * 3) * Math.max(0.5, p.s) });
    }
    this.ripple(x, z, 1.6);
  }

  sparkle(sx: number, sy: number, n = 18, color = '#ffe27a'): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 220;
      this.parts.push({ x: sx, y: sy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: 0.6 + Math.random() * 0.6, t: 0, color, size: 2 + Math.random() * 3 });
    }
  }

  float(text: string, sx: number, sy: number, color = '#ffffff', size = 30): void {
    this.floaters.push({ text, x: sx, y: sy, t: 0, color, size });
  }

  /** a fish leaping out of the water in an arc (Her, on the title screen and when she shows up) */
  leap(x: number, z: number, id = 'marlene', len = 3.2, dir = 1): void {
    this.leaps.push({ x, z, t: 0, id, len, dir, splashed: false });
    this.splash(x - dir * len * 0.6, z, 22, id === 'marlene' ? '#ffe7a0' : '#e8f6ff');
  }

  private leaps: { x: number; z: number; t: number; id: string; len: number; dir: number; splashed: boolean }[] = [];
  private arcs: { x0: number; y0: number; x1: number; y1: number; t: number; id: string; cm: number }[] = [];

  private drawArcs(c: CanvasRenderingContext2D, dt: number, now: number): void {
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      const a = this.arcs[i]!;
      a.t += dt;
      const u = a.t / ARC_TIME;
      if (u >= 1) {
        this.arcs.splice(i, 1);
        continue;
      }
      const e = 1 - (1 - u) * (1 - u);
      const x = a.x0 + (a.x1 - a.x0) * e;
      const y = a.y0 + (a.y1 - a.y0) * e - Math.sin(Math.PI * u) * 140;
      const sp = FISH[a.id]!;
      const len = Math.max(46, Math.min(240, a.cm * 1.4)) * (0.55 + 0.45 * u);
      c.save();
      c.translate(x, y);
      c.rotate(-1.2 + u * 1.2 + Math.sin(now * 20) * 0.15);
      drawFish(c, sp, len, { wag: Math.sin(now * 30), glow: sp.id === 'marlene' });
      c.restore();
      // a trail of drips
      c.fillStyle = 'rgba(230,245,255,0.8)';
      for (let k = 1; k <= 3; k++) {
        const uu = Math.max(0, u - k * 0.06);
        const ee = 1 - (1 - uu) * (1 - uu);
        c.beginPath();
        c.arc(a.x0 + (a.x1 - a.x0) * ee, a.y0 + (a.y1 - a.y0) * ee - Math.sin(Math.PI * uu) * 140 + k * 6, 3.5 - k * 0.8, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  private drawLeaps(c: CanvasRenderingContext2D, dt: number, now: number): void {
    for (let i = this.leaps.length - 1; i >= 0; i--) {
      const l = this.leaps[i]!;
      l.t += dt;
      const dur = 1.5;
      const u = l.t / dur;
      if (u >= 1) {
        this.leaps.splice(i, 1);
        continue;
      }
      if (u > 0.92 && !l.splashed) {
        l.splashed = true;
        this.splash(l.x + l.dir * l.len * 0.6, l.z, 26, l.id === 'marlene' ? '#ffe7a0' : '#e8f6ff');
      }
      const sp = FISH[l.id];
      if (!sp) continue;
      const p = project(l.x + l.dir * (u - 0.5) * l.len * 1.4, l.z);
      const h = Math.sin(Math.PI * u) * l.len * 1.6 * PX * p.s;
      c.save();
      c.translate(p.x, p.y - h);
      c.scale(l.dir, 1);
      c.rotate((u - 0.5) * 1.8);
      if (l.id === 'marlene') {
        c.globalAlpha = 0.5;
        c.drawImage(this.glowSprite!, -l.len * PX * p.s, -l.len * PX * p.s * 0.6, l.len * PX * p.s * 2, l.len * PX * p.s * 1.2);
        c.globalAlpha = 1;
      }
      drawFish(c, sp, l.len * PX * p.s, { wag: Math.sin(now * 12), glow: l.id === 'marlene' });
      c.restore();
    }
  }

  /** where an angler stands on screen */
  standAt(x: number): { x: number; y: number; s: number } {
    const p = project(x, STAND_Z);
    return { x: p.x, y: p.y + 40, s: 1 };
  }

  // ------------------------------------------------------------------ the static layer

  private buildBg(): void {
    const sky = this.sky;
    const b = this.biome;
    const rng = new Rng(this.spec.seed ^ 0xb6);
    this.bg = layer(W, H, (c) => {
      // sky
      const g = c.createLinearGradient(0, 0, 0, HORIZON + 40);
      g.addColorStop(0, sky.top);
      g.addColorStop(0.6, sky.mid);
      g.addColorStop(1, sky.low);
      c.fillStyle = g;
      c.fillRect(0, 0, W, HORIZON + 84);
      // stars
      if (sky.dark > 0.5 && this.spec.weather !== 'storm' && this.spec.weather !== 'fog') {
        for (let i = 0; i < 140; i++) {
          c.fillStyle = `rgba(255,255,240,${0.3 + rng.next() * 0.7})`;
          const r = rng.next() < 0.1 ? 1.8 : 1;
          c.fillRect(rng.range(0, W), rng.range(0, HORIZON - 20), r, r);
        }
      }
      // sun or moon
      if (this.spec.weather !== 'storm' && this.spec.weather !== 'fog') {
        const sr = this.spec.time === 'night' ? 34 : this.spec.time === 'day' ? 46 : 62;
        const halo = c.createRadialGradient(sky.sunX, sky.sunY, sr * 0.6, sky.sunX, sky.sunY, sr * 4);
        halo.addColorStop(0, alpha(sky.sun, 0.45));
        halo.addColorStop(1, alpha(sky.sun, 0));
        c.fillStyle = halo;
        c.fillRect(sky.sunX - sr * 4, sky.sunY - sr * 4, sr * 8, sr * 8);
        c.fillStyle = sky.sun;
        c.globalAlpha = this.spec.weather === 'clear' ? 1 : 0.55;
        c.beginPath();
        c.arc(sky.sunX, sky.sunY, sr, 0, Math.PI * 2);
        c.fill();
        if (this.spec.time === 'night') {
          // a full moon with a few craters
          c.fillStyle = 'rgba(160,160,140,0.35)';
          for (const [dx, dy, r] of [
            [-10, -8, 8],
            [9, 6, 6],
            [-4, 12, 4],
            [12, -12, 4],
          ] as const) {
            c.beginPath();
            c.arc(sky.sunX + dx, sky.sunY + dy, r, 0, Math.PI * 2);
            c.fill();
          }
        }
        c.globalAlpha = 1;
      }
      // the far bank
      this.drawFar(c, rng);
      // water
      const wg = c.createLinearGradient(0, HORIZON, 0, SHORE_Y + 20);
      const far = mix(mix(b.water[1], sky.low, 0.45), sky.tint, sky.tintA * 0.6);
      const near = mix(b.water[0], sky.tint, sky.tintA);
      wg.addColorStop(0, far);
      wg.addColorStop(0.35, mix(far, near, 0.5));
      wg.addColorStop(1, near);
      c.fillStyle = wg;
      c.fillRect(0, HORIZON + 78, W, SHORE_Y - HORIZON);
      // reflection of the far bank: a darker band right under it
      c.fillStyle = alpha(shade(far, -0.35), 0.35);
      c.fillRect(0, HORIZON + 78, W, 22);
      // the sky reflected on the far water
      const refl = c.createLinearGradient(0, HORIZON + 78, 0, HORIZON + 260);
      refl.addColorStop(0, alpha(sky.low, 0.55));
      refl.addColorStop(1, alpha(sky.low, 0));
      c.fillStyle = refl;
      c.fillRect(0, HORIZON + 78, W, 190);
      // gentle wave bands, and thin bright crests
      for (let i = 0; i < 30; i++) {
        const z = 1 + i * i * 0.075;
        const p = project(0, z);
        c.fillStyle = alpha(i % 2 ? shade(near, -0.16) : shade(near, 0.08), 0.3);
        c.fillRect(0, p.y, W, Math.max(1, flatR(z, 0.5)));
      }
      for (let i = 0; i < 90; i++) {
        const z = rng.range(1, 60);
        const p = project(rng.range(-60, 60), z);
        if (p.y < HORIZON + 82) continue;
        const w = rng.range(30, 120) * p.s;
        c.strokeStyle = alpha(b.water[2], 0.22);
        c.lineWidth = Math.max(1, 2 * p.s);
        c.beginPath();
        c.moveTo(p.x - w / 2, p.y);
        c.quadraticCurveTo(p.x, p.y - 3 * p.s, p.x + w / 2, p.y);
        c.stroke();
      }
      // sun / moon path on the water
      if (this.spec.weather === 'clear' || this.spec.weather === 'cloudy') {
        const rg = c.createLinearGradient(0, HORIZON + 80, 0, SHORE_Y);
        rg.addColorStop(0, alpha(sky.sun, 0.35));
        rg.addColorStop(1, alpha(sky.sun, 0));
        c.fillStyle = rg;
        c.beginPath();
        c.moveTo(sky.sunX - 18, HORIZON + 80);
        c.lineTo(sky.sunX + 18, HORIZON + 80);
        c.lineTo(CX + (sky.sunX - CX) * 0.55 + 140, SHORE_Y);
        c.lineTo(CX + (sky.sunX - CX) * 0.55 - 140, SHORE_Y);
        c.closePath();
        c.fill();
      }
      // floating props
      this.drawProps(c, rng);
      // the shore you stand on
      this.drawShore(c, rng);
      // the light of the time of day over everything near
      if (sky.tintA > 0) {
        c.fillStyle = alpha(sky.tint, sky.tintA * 0.5);
        c.fillRect(0, SHORE_Y - 20, W, H - SHORE_Y + 20);
      }
    });
    // clouds
    const nClouds = this.spec.weather === 'clear' ? 3 : this.spec.weather === 'cloudy' ? 7 : 6;
    const cc = this.spec.weather === 'storm' ? '#4a505e' : this.spec.weather === 'rain' ? '#9aa2ae' : this.spec.time === 'night' ? '#2a3460' : this.spec.time === 'dusk' ? '#f0a0a0' : '#ffffff';
    for (let i = 0; i < nClouds; i++) {
      const w = rng.range(180, 360);
      const img = layer(w, w * 0.45, (c) => {
        c.fillStyle = alpha(cc, this.spec.weather === 'clear' ? 0.75 : 0.9);
        for (let k = 0; k < 6; k++) {
          c.beginPath();
          c.ellipse(w * (0.2 + k * 0.12), w * 0.3 - Math.sin(k * 1.3) * w * 0.06, w * 0.16, w * 0.11, 0, 0, Math.PI * 2);
          c.fill();
        }
        c.fillRect(w * 0.12, w * 0.3, w * 0.76, w * 0.1);
      });
      this.clouds.push({ img, x: rng.range(-200, W), y: rng.range(20, HORIZON - 110), v: rng.range(6, 16) });
    }
    if (this.spec.weather === 'fog' || this.spec.weather === 'snow' || this.spec.weather === 'rain' || this.spec.weather === 'storm') {
      const fc = this.spec.time === 'night' ? '#3a4466' : '#e8ecf0';
      this.fog = layer(W, 220, (c) => {
        const g = c.createLinearGradient(0, 0, 0, 220);
        g.addColorStop(0, alpha(fc, 0));
        g.addColorStop(0.5, alpha(fc, this.spec.weather === 'fog' ? 0.55 : 0.25));
        g.addColorStop(1, alpha(fc, 0));
        c.fillStyle = g;
        c.fillRect(0, 0, W, 220);
      });
    }
    this.glowSprite = layer(200, 200, (c) => {
      const g = c.createRadialGradient(100, 100, 0, 100, 100, 100);
      g.addColorStop(0, 'rgba(255,220,110,0.75)');
      g.addColorStop(0.5, 'rgba(255,190,70,0.3)');
      g.addColorStop(1, 'rgba(255,190,70,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 200, 200);
    });
  }

  private drawFar(c: CanvasRenderingContext2D, rng: Rng): void {
    const sky = this.sky;
    const base = HORIZON + 80;
    const kind = this.biome.far;
    const fade = (col: string, k: number) => mix(col, sky.haze, k);
    const ridge = (col: string, y0: number, amp: number, freq: number, seedOff: number) => {
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(0, base + 2);
      for (let x = 0; x <= W; x += 20) c.lineTo(x, y0 - Math.abs(Math.sin(x * freq + seedOff)) * amp - Math.sin(x * freq * 2.7 + seedOff) * amp * 0.3);
      c.lineTo(W, base + 2);
      c.closePath();
      c.fill();
    };
    const pines = (col: string, y0: number, h: number, n: number) => {
      c.fillStyle = col;
      for (let i = 0; i < n; i++) {
        const x = (i / n) * W + rng.range(-10, 10);
        const th = h * rng.range(0.6, 1.3);
        c.beginPath();
        c.moveTo(x - th * 0.28, y0 + 2);
        c.lineTo(x, y0 - th);
        c.lineTo(x + th * 0.28, y0 + 2);
        c.fill();
      }
      c.fillRect(0, y0, W, base - y0 + 2);
    };
    if (kind === 'mountains') {
      c.fillStyle = fade('#6a7a9a', 0.45);
      c.beginPath();
      c.moveTo(0, base);
      const peaks = [0, 160, 300, 520, 700, 880, 1050, 1280, 1450, 1600];
      peaks.forEach((x, i) => c.lineTo(x, i % 2 ? base - rng.range(150, 230) : base - rng.range(60, 110)));
      c.lineTo(W, base);
      c.fill();
      c.fillStyle = fade('#f4f8ff', 0.25);
      for (let i = 1; i < peaks.length; i += 2) {
        const x = peaks[i]!;
        c.beginPath();
        c.moveTo(x - 34, base - 150);
        c.lineTo(x, base - 205);
        c.lineTo(x + 34, base - 150);
        c.fill();
      }
      pines(fade('#2e4a3e', 0.4), base - 18, 46, 70);
    } else if (kind === 'pines' || kind === 'snowpines') {
      ridge(fade('#4a6a6a', 0.6), base - 50, 40, 0.004, 1);
      pines(fade(kind === 'snowpines' ? '#5a7a7a' : '#2a4a3a', 0.35), base - 16, 56, 90);
      if (kind === 'snowpines') {
        c.fillStyle = fade('#f4f8ff', 0.2);
        c.fillRect(0, base - 6, W, 8);
      }
    } else if (kind === 'hills') {
      ridge(fade('#6a8a5a', 0.55), base - 40, 46, 0.0035, 2);
      ridge(fade('#4a7a4a', 0.3), base - 14, 26, 0.006, 4);
      c.fillStyle = fade('#2e5a3a', 0.3);
      for (let i = 0; i < 26; i++) {
        const x = rng.range(0, W);
        c.beginPath();
        c.arc(x, base - 16 - rng.range(0, 12), rng.range(8, 16), 0, Math.PI * 2);
        c.fill();
      }
    } else if (kind === 'cypress') {
      ridge(fade('#4a5a3a', 0.5), base - 24, 18, 0.005, 3);
      for (let i = 0; i < 14; i++) {
        const x = rng.range(0, W);
        const h = rng.range(60, 120);
        c.fillStyle = fade('#3a3a2a', 0.4);
        c.fillRect(x - 4, base - h, 8, h);
        c.fillStyle = fade('#4a5a34', 0.35);
        c.beginPath();
        c.ellipse(x, base - h, 40, 18, 0, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = fade('#7a8a6a', 0.4);
        c.lineWidth = 2;
        for (let k = -3; k <= 3; k++) {
          c.beginPath();
          c.moveTo(x + k * 9, base - h + 8);
          c.lineTo(x + k * 9 + 2, base - h + rng.range(24, 44));
          c.stroke();
        }
      }
    } else if (kind === 'sea') {
      c.fillStyle = fade('#5a7a8a', 0.6);
      c.beginPath();
      c.ellipse(1240, base, 170, 26, 0, Math.PI, 0);
      c.fill();
      // a lighthouse
      c.fillStyle = fade('#f0f0f0', 0.4);
      c.fillRect(1290, base - 70, 14, 50);
      c.fillStyle = fade('#e84a4a', 0.4);
      c.fillRect(1290, base - 56, 14, 8);
      c.fillRect(1290, base - 36, 14, 8);
      if (sky.dark > 0.3) {
        c.fillStyle = 'rgba(255,240,180,0.9)';
        c.beginPath();
        c.arc(1297, base - 74, 6, 0, Math.PI * 2);
        c.fill();
      }
    } else {
      ridge(fade('#6a8a5a', 0.5), base - 20, 14, 0.006, 5);
    }
  }

  private drawProps(c: CanvasRenderingContext2D, rng: Rng): void {
    const side = () => (rng.chance(0.5) ? -1 : 1) * rng.range(18, 44);
    const items: { z: number; draw: () => void }[] = [];
    for (const kind of this.biome.props) {
      const n = kind === 'lily' ? 7 : kind === 'ice' ? 9 : kind === 'reeds' ? 4 : kind === 'rocks' ? 4 : kind === 'cypress' ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const x = kind === 'reeds' || kind === 'cypress' ? (rng.chance(0.5) ? -1 : 1) * rng.range(26, 46) : side();
        const z = kind === 'reeds' ? rng.range(0.5, 12) : kind === 'cypress' ? rng.range(20, 50) : rng.range(2, 50);
        items.push({ z, draw: () => this.prop(c, kind, x, z, rng) });
      }
    }
    items.sort((a, b) => b.z - a.z);
    for (const it of items) it.draw();
  }

  private prop(c: CanvasRenderingContext2D, kind: string, x: number, z: number, rng: Rng): void {
    const p = project(x, z);
    const s = p.s;
    c.lineJoin = 'round';
    c.strokeStyle = alpha(INK, 0.7);
    c.lineWidth = Math.max(1, 2.5 * s);
    if (kind === 'lily') {
      const rx = 1.4 * PX * s;
      const ry = flatR(z, 1.4);
      c.fillStyle = mix('#4a9a4a', this.sky.tint, this.sky.tintA);
      c.beginPath();
      c.ellipse(p.x, p.y, rx, ry, 0, 0.35, Math.PI * 2 - 0.1);
      c.lineTo(p.x, p.y);
      c.closePath();
      c.fill();
      c.stroke();
      if (rng.chance(0.4)) {
        c.fillStyle = '#f4a0c0';
        c.beginPath();
        c.arc(p.x - rx * 0.2, p.y - ry * 0.6, Math.max(2, 7 * s), 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
    } else if (kind === 'rocks') {
      const r = rng.range(1, 2.2) * PX * s;
      c.fillStyle = mix('#8a8a84', this.sky.tint, this.sky.tintA);
      c.beginPath();
      c.ellipse(p.x, p.y, r, r * 0.55, 0, Math.PI, 0);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = alpha('#ffffff', 0.25);
      c.beginPath();
      c.ellipse(p.x - r * 0.3, p.y - r * 0.32, r * 0.3, r * 0.12, -0.3, 0, Math.PI * 2);
      c.fill();
    } else if (kind === 'log') {
      const l = 3 * PX * s;
      c.fillStyle = mix('#7a5a3a', this.sky.tint, this.sky.tintA);
      c.beginPath();
      c.roundRect(p.x - l / 2, p.y - 6 * s, l, 12 * s, 6 * s);
      c.fill();
      c.stroke();
    } else if (kind === 'reeds') {
      c.strokeStyle = mix('#4a7a3a', this.sky.tint, this.sky.tintA);
      c.lineWidth = Math.max(1.5, 3 * s);
      for (let k = 0; k < 9; k++) {
        const ox = (k - 4) * 6 * s;
        const h = rng.range(60, 120) * s;
        c.beginPath();
        c.moveTo(p.x + ox, p.y);
        c.quadraticCurveTo(p.x + ox + 4 * s, p.y - h * 0.5, p.x + ox + rng.range(-8, 8) * s, p.y - h);
        c.stroke();
        if (k % 3 === 0) {
          c.fillStyle = '#6a4a2a';
          c.beginPath();
          c.roundRect(p.x + ox - 3 * s, p.y - h * 0.82, 6 * s, 20 * s, 3 * s);
          c.fill();
        }
      }
    } else if (kind === 'ice') {
      const r = rng.range(1.2, 3) * PX * s;
      c.fillStyle = mix('#e8f4fc', this.sky.tint, this.sky.tintA * 0.6);
      c.beginPath();
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        const rr = r * rng.range(0.7, 1.1);
        c.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr * 0.35);
      }
      c.closePath();
      c.fill();
      c.stroke();
    } else if (kind === 'cypress') {
      const h = 220 * s;
      c.fillStyle = mix('#4a3a2a', this.sky.haze, 0.3);
      c.beginPath();
      c.moveTo(p.x - 16 * s, p.y);
      c.lineTo(p.x - 5 * s, p.y - h);
      c.lineTo(p.x + 5 * s, p.y - h);
      c.lineTo(p.x + 16 * s, p.y);
      c.closePath();
      c.fill();
      c.fillStyle = mix('#4a5a34', this.sky.haze, 0.3);
      c.beginPath();
      c.ellipse(p.x, p.y - h, 70 * s, 30 * s, 0, 0, Math.PI * 2);
      c.fill();
    }
  }

  private drawShore(c: CanvasRenderingContext2D, rng: Rng): void {
    const kind = this.biome.shore;
    const top = SHORE_Y + 14;
    c.lineJoin = 'round';
    c.strokeStyle = INK;
    c.lineWidth = 3;
    if (kind === 'dock' || kind === 'pier') {
      // the water under the boards, then the boardwalk
      c.fillStyle = kind === 'pier' ? '#8a6a4a' : '#a07a4a';
      c.fillRect(0, top + 20, W, H - top);
      c.fillStyle = shade(kind === 'pier' ? '#8a6a4a' : '#a07a4a', -0.3);
      c.fillRect(0, top + 8, W, 14);
      c.strokeRect(-4, top + 8, W + 8, 14);
      c.strokeStyle = alpha(INK, 0.45);
      c.lineWidth = 2;
      for (let y = top + 38; y < H; y += 22) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(W, y);
        c.stroke();
      }
      for (let i = 0; i < 40; i++) {
        const y = top + 22 + Math.floor(rng.range(0, 6)) * 22;
        const x = rng.range(0, W);
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x, y + 22);
        c.stroke();
      }
      c.fillStyle = shade('#7a5a3a', -0.2);
      c.strokeStyle = INK;
      c.lineWidth = 3;
      for (let x = 60; x < W; x += 260) {
        c.beginPath();
        c.roundRect(x, top - 26, 22, 56, 4);
        c.fill();
        c.stroke();
        if (kind === 'pier') {
          c.strokeStyle = '#d8c8a0';
          c.lineWidth = 4;
          c.beginPath();
          c.moveTo(x + 11, top - 16);
          c.quadraticCurveTo(x + 141, top + 4, x + 271, top - 16);
          c.stroke();
          c.strokeStyle = INK;
          c.lineWidth = 3;
        }
      }
    } else {
      const col: Record<string, string> = { rocks: '#7a7468', sand: '#e0c890', ice: '#e8f2fa', mud: '#6a5236', meadow: '#5a9a44' };
      const base = col[kind] ?? '#7a7468';
      c.fillStyle = base;
      c.beginPath();
      c.moveTo(0, H);
      c.lineTo(0, top + 10);
      for (let x = 0; x <= W; x += 40) c.lineTo(x, top + 4 + Math.sin(x * 0.013) * 6 + rng.range(-3, 3));
      c.lineTo(W, H);
      c.closePath();
      c.fill();
      c.stroke();
      if (kind === 'rocks') {
        for (let i = 0; i < 18; i++) {
          const x = rng.range(0, W);
          const r = rng.range(18, 46);
          c.fillStyle = shade(base, rng.range(-0.15, 0.15));
          c.beginPath();
          c.ellipse(x, top + 30 + rng.range(0, 70), r, r * 0.6, 0, 0, Math.PI * 2);
          c.fill();
          c.stroke();
        }
      } else if (kind === 'meadow' || kind === 'mud') {
        c.strokeStyle = kind === 'meadow' ? '#3a7a2a' : '#5a7a3a';
        c.lineWidth = 3;
        for (let i = 0; i < 120; i++) {
          const x = rng.range(0, W);
          const y = top + rng.range(4, 120);
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + rng.range(-5, 5), y - rng.range(8, 20));
          c.stroke();
        }
        if (kind === 'meadow')
          for (let i = 0; i < 30; i++) {
            c.fillStyle = rng.pick(['#f4e04a', '#f0a0c0', '#ffffff', '#a0c0f0']);
            c.beginPath();
            c.arc(rng.range(0, W), top + rng.range(10, 120), 4, 0, Math.PI * 2);
            c.fill();
          }
      } else if (kind === 'ice') {
        c.strokeStyle = alpha('#9ac0dc', 0.8);
        c.lineWidth = 2;
        for (let i = 0; i < 14; i++) {
          const x = rng.range(0, W);
          const y = top + rng.range(10, 110);
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + rng.range(-60, 60), y + rng.range(-10, 20));
          c.stroke();
        }
      } else if (kind === 'sand') {
        c.fillStyle = alpha('#ffffff', 0.4);
        for (let i = 0; i < 12; i++) {
          c.beginPath();
          c.ellipse(rng.range(0, W), top + rng.range(10, 110), rng.range(4, 10), 3, 0, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
  }

  // ------------------------------------------------------------------ every frame

  draw(c: CanvasRenderingContext2D, dt: number, now: number): void {
    this.time += dt;
    if (!this.bg) this.buildBg();
    const shake = this.shake > 0 ? this.shake : 0;
    this.shake = Math.max(0, this.shake - dt * 30);
    c.save();
    if (shake) c.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    const pr = pixelRatio();
    c.drawImage(this.bg!, 0, 0, this.bg!.width / pr, this.bg!.height / pr);
    // clouds drift
    for (const cl of this.clouds) {
      cl.x += cl.v * dt * (1 + Math.abs(this.wind) * 0.5);
      const w = cl.img.width / pr;
      if (cl.x > W + 20) cl.x = -w - 20;
      c.drawImage(cl.img, cl.x, cl.y, w, cl.img.height / pr);
    }
    this.drawShimmer(c, now);
    this.drawShadows(c, dt, now);
    this.drawDyn(c, now);
    this.drawRipples(c);
    if (this.world) this.drawBubbles(c, now);
    if (this.guide && !this.demo) this.drawGuide(c, now);
    this.drawLeaps(c, dt, now);
    this.drawBobbersAndAnglers(c, dt, now);
    this.drawArcs(c, dt, now);
    this.drawParticles(c, dt);
    this.drawWeather(c, dt, now);
    this.drawFloaters(c, dt);
    c.restore();
    this.overlay?.(c, now);
    // lightning
    if (this.world && this.world.flash !== this.lastFlash && this.world.flash > 0) {
      this.lastFlash = this.world.flash;
      this.flashA = 0.85;
    }
    if (this.flashA > 0) {
      c.fillStyle = `rgba(235,240,255,${this.flashA})`;
      c.fillRect(0, 0, W, H);
      this.flashA = Math.max(0, this.flashA - dt * 2.4);
    }
  }

  private drawShimmer(c: CanvasRenderingContext2D, now: number): void {
    const hi = this.biome.water[2];
    const sun = this.sky.sun;
    const buckets: [string, number][] = [
      [hi, 0.18],
      [hi, 0.38],
      [sun, 0.6],
    ];
    for (let bi = 0; bi < buckets.length; bi++) {
      c.strokeStyle = alpha(buckets[bi]![0], buckets[bi]![1]);
      c.lineWidth = bi === 2 ? 2 : 1.6;
      c.beginPath();
      for (const s of this.shimmer) {
        const a = Math.sin(now * s.sp + s.ph);
        const b = s.sun ? (a > 0.3 ? 2 : -1) : a > 0.55 ? 1 : a > -0.1 ? 0 : -1;
        if (b !== bi) continue;
        const drift = Math.sin(now * 0.3 + s.ph) * 0.6 + this.wind * now * 0.3;
        const x = ((s.x + drift + 70) % 140) - 70;
        const p = project(x, s.z);
        if (p.y < HORIZON + 84 || p.y > SHORE_Y) continue;
        const w = s.w * p.s;
        c.moveTo(p.x - w / 2, p.y);
        c.lineTo(p.x + w / 2, p.y);
      }
      c.stroke();
    }
  }

  private drawShadows(c: CanvasRenderingContext2D, dt: number, now: number): void {
    c.fillStyle = 'rgba(10,25,35,0.22)';
    for (const f of this.shadows) {
      f.a += dt * 0.25 * f.v;
      f.x += Math.cos(f.a) * f.v * dt;
      f.z += Math.sin(f.a) * f.v * dt * 0.6;
      if (f.z < 5 || f.z > 46) f.a += Math.PI;
      if (Math.abs(f.x) > 36) f.a = Math.PI - f.a;
      const p = project(f.x, f.z);
      const rx = f.len * PX * p.s * 0.5;
      c.beginPath();
      c.ellipse(p.x, p.y, rx, flatR(f.z, f.len * 0.18), Math.cos(f.a) * 0.1, 0, Math.PI * 2);
      c.fill();
    }
    void now;
  }

  private drawDyn(c: CanvasRenderingContext2D, now: number): void {
    for (const d of this.dyn) {
      d.x += d.vx * 0.016;
      if (Math.abs(d.x) > 44) d.vx = -d.vx;
      const p = project(d.x, d.z);
      const bob = Math.sin(now * 2 + d.ph) * 3 * p.s;
      c.save();
      c.translate(p.x, p.y + bob);
      c.scale(p.s, p.s);
      c.strokeStyle = INK;
      c.lineWidth = 3;
      if (d.kind === 'buoy') {
        c.fillStyle = '#e84a4a';
        c.beginPath();
        c.moveTo(-16, 0);
        c.lineTo(-8, -40);
        c.lineTo(8, -40);
        c.lineTo(16, 0);
        c.closePath();
        c.fill();
        c.stroke();
        c.fillStyle = '#f4f4f4';
        c.fillRect(-12, -24, 24, 10);
      } else {
        c.fillStyle = '#7a5a3a';
        c.beginPath();
        c.ellipse(0, -8, 22, 11, 0, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.fillStyle = '#2a7a4a';
        c.beginPath();
        c.arc(d.vx >= 0 ? 16 : -16, -22, 9, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.fillStyle = '#f0a030';
        c.beginPath();
        c.moveTo(d.vx >= 0 ? 24 : -24, -22);
        c.lineTo(d.vx >= 0 ? 34 : -34, -19);
        c.lineTo(d.vx >= 0 ? 24 : -24, -17);
        c.fill();
      }
      c.restore();
    }
  }

  private drawRipples(c: CanvasRenderingContext2D): void {
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i]!;
      const age = this.time - r.t0;
      const life = r.gold ? 2.2 : 1.4;
      if (age > life) {
        this.ripples.splice(i, 1);
        continue;
      }
      const u = age / life;
      const p = project(r.x, r.z);
      const rad = r.r * (0.3 + u * 1.6);
      c.strokeStyle = r.gold ? `rgba(255,210,90,${(1 - u) * 0.9})` : `rgba(240,250,255,${(1 - u) * 0.7})`;
      c.lineWidth = Math.max(1, 2.5 * p.s);
      c.beginPath();
      c.ellipse(p.x, p.y, rad * PX * p.s, flatR(r.z, rad), 0, 0, Math.PI * 2);
      c.stroke();
    }
  }

  private drawBubbles(c: CanvasRenderingContext2D, now: number): void {
    const w = this.world!;
    for (const b of w.bubbles) {
      const p = project(b.x, b.z);
      const age = w.t - b.born;
      const fadeIn = Math.min(1, age / 0.8);
      const fadeOut = Math.min(1, (b.life - age) / 3);
      const a = Math.max(0, Math.min(fadeIn, fadeOut));
      const rx = b.r * PX * p.s;
      const ry = flatR(b.z, b.r);
      if (b.legend) {
        const pr = pixelRatio();
        void pr;
        const gs = rx * 2.6;
        c.globalAlpha = a * (0.75 + Math.sin(now * 3) * 0.2);
        c.drawImage(this.glowSprite!, p.x - gs, p.y - gs * 0.45, gs * 2, gs * 0.9);
        c.globalAlpha = a;
        // her shadow circling under the ripple
        const ang = now * 1.2;
        const sx = p.x + Math.cos(ang) * rx * 0.55;
        const sy = p.y + Math.sin(ang) * ry * 0.55;
        c.fillStyle = 'rgba(120,70,0,0.45)';
        c.beginPath();
        c.ellipse(sx, sy, rx * 0.5, ry * 0.22, Math.cos(ang + Math.PI / 2) * 0.2, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = `rgba(255,214,100,${a})`;
        c.lineWidth = Math.max(1.5, 3 * p.s);
        for (let k = 0; k < 3; k++) {
          const u = ((now * 0.6 + k / 3) % 1);
          c.globalAlpha = a * (1 - u);
          c.beginPath();
          c.ellipse(p.x, p.y, rx * (0.4 + u * 0.9), ry * (0.4 + u * 0.9), 0, 0, Math.PI * 2);
          c.stroke();
        }
        c.globalAlpha = a;
        c.fillStyle = '#fff3c0';
        for (let k = 0; k < 7; k++) {
          const t = now * 1.7 + k * 0.9;
          const sx2 = p.x + Math.cos(t * 1.3 + k) * rx * 0.8;
          const sy2 = p.y - ((t * 30) % 40) * p.s + Math.sin(t + k) * ry * 0.5;
          c.beginPath();
          c.arc(sx2, sy2, 2.5 * Math.max(0.6, p.s), 0, Math.PI * 2);
          c.fill();
        }
        c.globalAlpha = 1;
        continue;
      }
      // a pale patch of foam, a ring pulsing out, the catchment ring (dashed) and the bullseye
      c.globalAlpha = a;
      c.fillStyle = 'rgba(230,250,255,0.16)';
      c.beginPath();
      c.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
      c.fill();
      const pulse = (now * 0.7 + b.id * 0.37) % 1;
      c.strokeStyle = `rgba(255,255,255,${0.5 * (1 - pulse)})`;
      c.lineWidth = Math.max(1, 2.5 * p.s);
      c.beginPath();
      c.ellipse(p.x, p.y, rx * (0.3 + pulse * 0.9), ry * (0.3 + pulse * 0.9), 0, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.45)';
      c.lineWidth = Math.max(1, 2 * p.s);
      c.setLineDash([6 * p.s, 6 * p.s]);
      c.beginPath();
      c.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.beginPath();
      c.ellipse(p.x, p.y, rx * 0.4, ry * 0.4, 0, 0, Math.PI * 2);
      c.fill();
      // the fizz
      c.strokeStyle = 'rgba(255,255,255,0.85)';
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.lineWidth = Math.max(1, 1.6 * p.s);
      const n = 8 + b.cap * 4;
      const bs = Math.max(0.7, p.s * 1.3);
      for (let k = 0; k < n; k++) {
        const ph = (now * (0.8 + (k % 3) * 0.3) + k * 0.37) % 1;
        const ang = k * 2.4 + b.id;
        const bx = p.x + Math.cos(ang) * rx * 0.6 * ((k * 7) % 10) / 10;
        const by = p.y + Math.sin(ang) * ry * 0.6 * ((k * 3) % 10) / 10 - ph * 12 * bs;
        const br = (2.4 + (k % 3) * 1.8) * bs * (1 - ph * 0.5);
        c.beginPath();
        c.arc(bx, by, br, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
      // how many fish are left in it
      c.fillStyle = 'rgba(20,40,60,0.55)';
      for (let k = 0; k < b.cap; k++) {
        const t = now * 0.9 + k * 2.1;
        c.beginPath();
        c.ellipse(p.x + Math.cos(t) * rx * 0.45, p.y + Math.sin(t) * ry * 0.45, 0.8 * PX * p.s, flatR(b.z, 0.25), Math.cos(t + 1.57) * 0.3, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
    }
  }

  private drawGuide(c: CanvasRenderingContext2D, now: number): void {
    const g = this.guide!;
    const stand = this.standAt(g.x);
    c.fillStyle = 'rgba(255,255,255,0.6)';
    const steps = 16;
    for (let i = 1; i <= steps; i++) {
      const d = 4 + ((g.reach - 4) * i) / steps;
      const x = g.x + Math.sin(g.aim) * d;
      const z = Math.cos(g.aim) * d;
      const p = project(x, z);
      if (g.charging && d > 4 + (g.reach - 4) * g.power) c.fillStyle = 'rgba(255,255,255,0.22)';
      c.beginPath();
      c.arc(p.x, p.y, Math.max(1.5, 3.2 * p.s), 0, Math.PI * 2);
      c.fill();
    }
    // the end of your reach
    const ex = g.x + Math.sin(g.aim) * g.reach;
    const ez = Math.cos(g.aim) * g.reach;
    const ep = project(ex, ez);
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(ep.x - 10 * ep.s, ep.y);
    c.lineTo(ep.x + 10 * ep.s, ep.y);
    c.stroke();
    if (g.charging) {
      const p = project(g.landX, g.landZ);
      const col = g.inBubble ? '#7cff9a' : '#ffffff';
      c.strokeStyle = col;
      c.lineWidth = 3;
      c.beginPath();
      c.ellipse(p.x, p.y, 1.1 * PX * p.s, flatR(g.landZ, 1.1), 0, 0, Math.PI * 2);
      c.stroke();
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(p.x, p.y - flatR(g.landZ, 1.1) - 8);
      c.lineTo(p.x, p.y - flatR(g.landZ, 1.1) - 18 - Math.sin(now * 12) * 3);
      c.stroke();
    }
    void stand;
  }

  private bobberScreen(v: AnglerView): { x: number; y: number; s: number } {
    const p = project(v.bx, Math.max(0, v.bz));
    return { x: p.x, y: p.y - v.bh * PX * p.s, s: p.s };
  }

  private drawBobbersAndAnglers(c: CanvasRenderingContext2D, dt: number, now: number): void {
    // bobbers first (they're out on the water, above the anglers on screen)
    for (const a of this.anglers) {
      const v = a.view;
      if (a.lastPhase !== v.phase) {
        // a fish just came out of the water: it flies up into the angler's hands
        if (v.phase === 'landing' && a.lastB && FISH[v.fish]) {
          const st = this.standAt(v.x);
          this.arcs.push({ x0: a.lastB.x, y0: a.lastB.y, x1: st.x, y1: st.y - 190, t: 0, id: v.fish, cm: a.shownCm || (FISH[v.fish]!.cm[0] + FISH[v.fish]!.cm[1]) / 2 });
          this.splash(a.lastB.bx, a.lastB.bz, 16);
        }
        a.lastPhase = v.phase;
        a.pt = 0;
      } else a.pt += dt;
      if (v.phase === 'reeling') {
        const b = this.bobberScreen(v);
        a.lastB = { x: b.x, y: b.y, bx: v.bx, bz: v.bz };
      }
      if (v.phase === 'flying' || v.phase === 'waiting' || v.phase === 'bite' || v.phase === 'reeling' || v.phase === 'reelin') {
        const b = this.bobberScreen(v);
        if (v.phase === 'flying') {
          const g = project(v.bx, v.bz);
          c.fillStyle = 'rgba(0,0,0,0.2)';
          c.beginPath();
          c.ellipse(g.x, g.y, 7 * g.s, 2.5 * g.s, 0, 0, Math.PI * 2);
          c.fill();
        }
        const bs = Math.max(0.8, b.s * 1.5);
        this.drawBobber(c, b.x, b.y + (v.phase === 'bite' ? 7 * bs : v.dip * 6 * bs), bs, v, a, now);
      }
    }
    // anglers, back to front isn't needed (they stand in a row): draw, then their lines
    for (const a of this.anglers) {
      const st = this.standAt(a.view.x);
      const v = a.view;
      c.save();
      c.translate(st.x, st.y);
      const holding = v.phase === 'landing' && a.pt >= ARC_TIME;
      const tip = drawAngler(c, a.look, { pose: poseFor(v.phase), aim: v.aim, power: v.power, pt: a.pt, now, fy: v.fy, fish: holding ? v.fish : undefined, fishCm: a.shownCm });
      c.restore();
      const tx = st.x + tip.tx;
      const ty = st.y + tip.ty;
      if (v.phase === 'flying' || v.phase === 'waiting' || v.phase === 'bite' || v.phase === 'reeling' || v.phase === 'reelin') {
        const b = this.bobberScreen(v);
        const taut = v.phase === 'reeling' || v.phase === 'bite';
        const midX = (tx + b.x) / 2 + (taut ? Math.sin(now * 40) * 2 : 0);
        const midY = (ty + b.y) / 2 + (taut ? 0 : 50);
        c.strokeStyle = 'rgba(255,255,255,0.8)';
        c.lineWidth = 1.4;
        c.beginPath();
        c.moveTo(tx, ty);
        c.quadraticCurveTo(midX, midY, b.x, b.y);
        c.stroke();
      }
      // name tag and the reel meter for other players
      if (a.name && (!a.local || this.anglers.length > 1)) {
        c.font = '700 18px Fredoka, sans-serif';
        c.textAlign = 'center';
        const label = a.name;
        const tw = c.measureText(label).width + 18;
        c.fillStyle = alpha(a.color, 0.92);
        c.strokeStyle = INK;
        c.lineWidth = 2;
        c.beginPath();
        c.roundRect(st.x - tw / 2, st.y + 6, tw, 26, 13);
        c.fill();
        c.stroke();
        c.fillStyle = '#1b1a2e';
        c.fillText(label, st.x, st.y + 25);
        if (!a.local && v.phase === 'reeling') {
          c.fillStyle = 'rgba(0,0,0,0.5)';
          c.fillRect(st.x - 40, st.y - 232, 80, 10);
          c.fillStyle = v.prog > 0.6 ? '#7cff9a' : v.prog > 0.3 ? '#ffd23a' : '#ff6a5a';
          c.fillRect(st.x - 40, st.y - 232, 80 * v.prog, 10);
        }
      }
    }
  }

  private drawBobber(c: CanvasRenderingContext2D, x: number, y: number, s: number, v: AnglerView, a: LakeAngler, now: number): void {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.strokeStyle = INK;
    c.lineWidth = 2.5;
    const lureCol: Record<string, [string, string]> = {
      bobber: ['#e84a4a', '#f8f8f8'],
      cork: ['#c89a5a', '#f0f0f0'],
      lead: ['#6a6a72', '#b0b0b8'],
      trap: ['#5a8a3a', '#f0e060'],
      bubble: ['#6ad0f0', '#f8f8ff'],
    };
    const [top, bottom] = lureCol[a.lure] ?? ['#e84a4a', '#f8f8f8'];
    if (v.phase === 'reeling') {
      // the fish thrashing at the surface
      const t = now * 18;
      c.fillStyle = 'rgba(255,255,255,0.7)';
      for (let k = 0; k < 5; k++) {
        c.beginPath();
        c.arc(Math.cos(t + k * 1.3) * 14, -Math.abs(Math.sin(t * 0.7 + k)) * 12, 3, 0, Math.PI * 2);
        c.fill();
      }
      const sp = FISH[v.fish];
      if (sp && Math.sin(now * 3.1) > 0.85) {
        c.save();
        c.translate(0, -10);
        c.rotate(-0.4);
        drawFish(c, sp, 36, { wag: Math.sin(now * 20) });
        c.restore();
      }
    } else {
      c.fillStyle = bottom;
      c.beginPath();
      c.arc(0, 0, 9, 0, Math.PI);
      c.fill();
      c.stroke();
      c.fillStyle = top;
      c.beginPath();
      c.arc(0, 0, 9, Math.PI, 0);
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(0, -9);
      c.lineTo(0, -15);
      c.stroke();
      if (v.phase === 'bite') {
        c.fillStyle = '#ffe24a';
        c.strokeStyle = INK;
        c.lineWidth = 3;
        c.font = '900 46px "Lilita One", sans-serif';
        c.textAlign = 'center';
        const jump = Math.abs(Math.sin(now * 14)) * 6;
        c.strokeText('!', 0, -26 - jump);
        c.fillText('!', 0, -26 - jump);
      }
    }
    c.restore();
  }

  private drawParticles(c: CanvasRenderingContext2D, dt: number): void {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]!;
      p.t += dt;
      if (p.t >= p.life) {
        this.parts.splice(i, 1);
        continue;
      }
      p.vy += 520 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      c.globalAlpha = 1 - p.t / p.life;
      c.fillStyle = p.color;
      c.beginPath();
      c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  private drawWeather(c: CanvasRenderingContext2D, dt: number, now: number): void {
    const wind = this.world?.flags.wind ? this.wind : this.spec.weather === 'storm' ? 0.4 : 0.1;
    if (this.rain.length) {
      c.strokeStyle = this.spec.time === 'night' ? 'rgba(170,190,230,0.45)' : 'rgba(220,230,245,0.55)';
      c.lineWidth = 1.5;
      c.beginPath();
      for (const r of this.rain) {
        r.y += r.v * dt;
        r.x += wind * 260 * dt;
        if (r.y > H) {
          r.y = -30;
          r.x = Math.random() * W;
        }
        if (r.x > W) r.x -= W;
        if (r.x < 0) r.x += W;
        c.moveTo(r.x, r.y);
        c.lineTo(r.x + wind * 8, r.y + r.l);
      }
      c.stroke();
      // drops landing on the water
      c.strokeStyle = 'rgba(230,240,255,0.4)';
      c.lineWidth = 1;
      c.beginPath();
      for (let i = 0; i < 18; i++) {
        const x = (Math.sin(i * 91.7 + Math.floor(now * 3 + i * 0.37) * 13.1) * 0.5 + 0.5) * W;
        const y = HORIZON + 100 + (Math.cos(i * 37.3 + Math.floor(now * 3 + i * 0.37) * 7.7) * 0.5 + 0.5) * (SHORE_Y - HORIZON - 100);
        const u = (now * 3 + i * 0.37) % 1;
        c.moveTo(x + 6 * u, y);
        c.ellipse(x, y, 6 * u, 2 * u, 0, 0, Math.PI * 2);
      }
      c.stroke();
    }
    if (this.flakes.length) {
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.beginPath();
      for (const f of this.flakes) {
        f.y += f.v * dt;
        f.x += (Math.sin(now + f.ph) * 20 + wind * 60) * dt;
        if (f.y > H) {
          f.y = -10;
          f.x = Math.random() * W;
        }
        if (f.x > W) f.x -= W;
        if (f.x < 0) f.x += W;
        c.moveTo(f.x + f.r, f.y);
        c.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      }
      c.fill();
    }
    if (this.fog) {
      const pr = pixelRatio();
      const fw = this.fog.width / pr;
      const fh = this.fog.height / pr;
      const off = (now * 12) % fw;
      c.globalAlpha = 0.9;
      c.drawImage(this.fog, -off, HORIZON - 30, fw, fh);
      c.drawImage(this.fog, fw - off, HORIZON - 30, fw, fh);
      if (this.spec.weather === 'fog') {
        c.globalAlpha = 0.5;
        c.drawImage(this.fog, off - fw, HORIZON + 140, fw, fh);
        c.drawImage(this.fog, off, HORIZON + 140, fw, fh);
      }
      c.globalAlpha = 1;
    }
    if (this.flies.length) {
      for (const f of this.flies) {
        const a = Math.max(0, Math.sin(now * 1.7 + f.ph));
        if (a < 0.05) continue;
        const x = f.x + Math.sin(now * 0.5 + f.ph) * 30;
        const y = f.y + Math.cos(now * 0.7 + f.ph) * 14;
        c.fillStyle = `rgba(220,255,120,${a * 0.9})`;
        c.beginPath();
        c.arc(x, y, 2.6, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = `rgba(220,255,120,${a * 0.2})`;
        c.beginPath();
        c.arc(x, y, 9, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  private drawFloaters(c: CanvasRenderingContext2D, dt: number): void {
    c.textAlign = 'center';
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]!;
      f.t += dt;
      if (f.t > 1.6) {
        this.floaters.splice(i, 1);
        continue;
      }
      const u = f.t / 1.6;
      c.globalAlpha = u < 0.75 ? 1 : 1 - (u - 0.75) / 0.25;
      c.font = `900 ${f.size}px "Lilita One", sans-serif`;
      const y = f.y - u * 70;
      c.lineWidth = 6;
      c.strokeStyle = INK;
      c.strokeText(f.text, f.x, y);
      c.fillStyle = f.color;
      c.fillText(f.text, f.x, y);
    }
    c.globalAlpha = 1;
  }
}
