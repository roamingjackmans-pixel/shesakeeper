// Pictures for the menus: a small canvas on the page that copies a sprite (drawn once, cached) at the size it's
// shown. Copying is nearly free; the old way (an image per picture, PNG-encoded on the spot) made a glovebox of 60
// ornaments stutter on slow machines.
import type { Ornament } from '../core/ornament';
import { stageScale } from '../ui/stage';
import { fishSprite } from './fishart';
import { gearSprite } from './gearart';
import { ornamentSprite } from './ornart';

type Attrs = { title?: string; style?: string; class?: string };

function picture(sprite: HTMLCanvasElement, w: number, h: number, a: Attrs = {}): HTMLCanvasElement {
  const r = Math.max(1, Math.min(2, (window.devicePixelRatio || 1) * stageScale()));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * r));
  c.height = Math.max(1, Math.round(h * r));
  c.setAttribute('style', `${a.style ? a.style + ';' : ''}width:${w}px;height:${h}px`);
  if (a.title) c.title = a.title;
  if (a.class) c.className = a.class;
  c.setAttribute('role', 'img');
  if (a.title) c.setAttribute('aria-label', a.title);
  const x = c.getContext('2d')!;
  x.imageSmoothingQuality = 'high';
  x.drawImage(sprite, 0, 0, c.width, c.height);
  return c;
}

export const ornPic = (o: Pick<Ornament, 'type' | 'tint' | 'tier'>, size: number, a?: Attrs): HTMLCanvasElement => picture(ornamentSprite(o), size, size, a);
export const fishPic = (id: string, w: number, h: number, silhouette = false, a?: Attrs): HTMLCanvasElement => picture(fishSprite(id, silhouette), w, h, a);
export const gearPic = (id: string, size: number, a?: Attrs): HTMLCanvasElement => picture(gearSprite(id), size, size, a);
