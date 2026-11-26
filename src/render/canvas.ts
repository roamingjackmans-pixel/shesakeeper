// The one game canvas under the DOM menus, sized to the stage (1600×900 logical pixels) × the window scale × the
// device pixel ratio (capped at 2). Scenes draw in logical pixels.
import { onScale, stageScale, STAGE_H, STAGE_W } from '../ui/stage';

export interface Scene {
  draw(ctx: CanvasRenderingContext2D, dt: number, now: number): void;
  /** the backing resolution changed: re-render cached layers */
  resize?(): void;
}

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

function size(): void {
  if (!canvas) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  res = Math.max(0.5, stageScale() * dpr);
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
    for (const t of tickers) t(dt, now / 1000);
    if (scene && ctx) {
      ctx.setTransform(res, 0, 0, res, 0, 0);
      scene.draw(ctx, dt, now / 1000);
    }
  };
  raf = requestAnimationFrame(loop);
  void raf;
  return canvas;
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
