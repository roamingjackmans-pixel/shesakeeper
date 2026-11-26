// The one game canvas under the DOM menus, sized to the stage (1600×900 logical pixels) × the window scale × the
// device pixel ratio (capped at 2). Scenes draw in logical pixels.
import { onScale, stageScale, STAGE_H, STAGE_W } from '../ui/stage';

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, dt: number, now: number): void;
  /** the backing resolution changed: re-render cached layers */
  resize?(): void;
}

/** development only: frame timings (window.__perf) for the speed checks */
class Perf {
  sim: number[] = [];
  draw: number[] = [];
  gaps: number[] = [];
  add(sim: number, draw: number, dt: number): void {
    this.sim.push(sim);
    this.draw.push(draw);
    this.gaps.push(dt * 1000);
    if (this.sim.length > 600) {
      this.sim.shift();
      this.draw.shift();
      this.gaps.shift();
    }
  }
  reset(): void {
    this.sim = [];
    this.draw = [];
    this.gaps = [];
  }
  report() {
    const st = (a: number[]) => {
      const s = [...a].sort((x, y) => x - y);
      return { avg: +(a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)).toFixed(2), p95: +(s[Math.floor(s.length * 0.95)] ?? 0).toFixed(2), max: +(s[s.length - 1] ?? 0).toFixed(2) };
    };
    return { frames: this.sim.length, sim: st(this.sim), draw: st(this.draw), frameGap: st(this.gaps), canvas: canvas ? `${canvas.width}x${canvas.height}` : '' };
  }
}
const perf = import.meta.env.DEV ? new Perf() : null;
if (perf) (window as unknown as { __perf: Perf }).__perf = perf;

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let scene: Scene | null = null;
let res = 1;
let last = 0;
let raf = 0;
const tickers = new Set<(dt: number, now: number) => void>();

export function pixelRatio(): number {
  return res;
}

/**
 * The most backing pixels per stage pixel. 1.6 is 2560×1440: sharp on a laptop, and on a 4K screen 2.25× fewer pixels
 * to fill than full resolution (the cartoon art doesn't need more). Lowered automatically when frames run long.
 */
let maxRes = 1.6;
const slow = { since: 0, steps: 0 };

function size(): void {
  if (!canvas) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  res = Math.max(0.5, Math.min(maxRes, stageScale() * dpr));
  const w = Math.round(STAGE_W * res);
  const h = Math.round(STAGE_H * res);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    scene?.resize?.();
  }
}

export function mountCanvas(parent: HTMLElement): HTMLCanvasElement {
  canvas = document.createElement('canvas');
  canvas.id = 'game';
  canvas.style.width = `${STAGE_W}px`;
  canvas.style.height = `${STAGE_H}px`;
  parent.prepend(canvas);
  ctx = canvas.getContext('2d', { alpha: false })!;
  size();
  onScale(size);
  const loop = (now: number): void => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    const t0 = perf ? performance.now() : 0;
    for (const t of tickers) t(dt, now / 1000);
    const t1 = perf ? performance.now() : 0;
    if (scene && ctx) {
      ctx.setTransform(res, 0, 0, res, 0, 0);
      scene.draw(ctx, dt, now / 1000);
    }
    if (perf) perf.add(t1 - t0, performance.now() - t1, dt);
    watchSpeed(now, dt);
  };
  raf = requestAnimationFrame(loop);
  void raf;
  return canvas;
}

/**
 * A slow machine (frames well over 1/45 s for three seconds running, with the tab visible) gets a lower resolution,
 * one step at a time, at most twice.
 */
let slowFrames = 0;
let allFrames = 0;
function watchSpeed(now: number, dt: number): void {
  if (slow.steps >= 2 || document.hidden) return;
  allFrames++;
  if (dt > 1 / 45) slowFrames++;
  if (!slow.since) slow.since = now;
  if (now - slow.since < 3000) return;
  const mostlySlow = allFrames > 30 && slowFrames / allFrames > 0.6;
  slow.since = now;
  slowFrames = 0;
  allFrames = 0;
  if (!mostlySlow) return;
  slow.steps++;
  maxRes = Math.max(0.75, Math.min(maxRes, res) * 0.75);
  size();
}

export function setScene(s: Scene | null): void {
  scene = s;
  s?.resize?.();
}

export function currentScene(): Scene | null {
  return scene;
}

/** something to run every frame (input, simulation) whatever the scene */
export function onTick(fn: (dt: number, now: number) => void): () => void {
  tickers.add(fn);
  return () => tickers.delete(fn);
}

export function gameCanvas(): HTMLCanvasElement | null {
  return canvas;
}

/** an offscreen canvas at the current resolution, drawn in logical pixels */
export function layer(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, scale = res): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  const x = c.getContext('2d')!;
  x.scale(scale, scale);
  draw(x);
  return c;
}

export { STAGE_W, STAGE_H };
