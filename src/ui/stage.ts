// The stage: a fixed 1600×900 board scaled to fit the window, letterboxed.
// Everything is laid out in stage pixels; the canvas games draw at the scale × device pixel ratio (capped at 2).
export const STAGE_W = 1600;
export const STAGE_H = 900;

let scale = 1;
const subs = new Set<() => void>();

export function stageScale(): number {
  return scale;
}

export function onScale(fn: () => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function fitStage(): void {
  const el = document.getElementById('stage');
  if (!el) return;
  const vw = window.visualViewport?.width ?? window.innerWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  const s = Math.min(vw / STAGE_W, vh / STAGE_H);
  scale = s;
  el.style.transform = `translate(${Math.round((vw - STAGE_W * s) / 2)}px, ${Math.round((vh - STAGE_H * s) / 2)}px) scale(${s})`;
  document.body.classList.toggle('portrait', vh > vw * 1.1);
  for (const f of subs) f();
}

export function watchStage(): void {
  fitStage();
  let t = 0;
  const later = (): void => {
    cancelAnimationFrame(t);
    t = requestAnimationFrame(fitStage);
  };
  window.addEventListener('resize', later);
  window.visualViewport?.addEventListener('resize', later);
  window.addEventListener('orientationchange', () => setTimeout(fitStage, 250));
}
