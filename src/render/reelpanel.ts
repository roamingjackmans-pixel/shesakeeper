// The local player's instruments, drawn over the lake: the cast meter while charging, the hook prompt when a fish
// bites, and the reel (catch bar, fish, treasure chest, catch meter) while reeling.
import type { Angler } from '../core/angler';
import { INK } from './fishart';

function frame(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill = '#f6e6c0'): void {
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.beginPath();
  c.roundRect(x + 5, y + 7, w, h, 16);
  c.fill();
  c.fillStyle = fill;
  c.strokeStyle = INK;
  c.lineWidth = 4;
  c.beginPath();
  c.roundRect(x, y, w, h, 16);
  c.fill();
  c.stroke();
}

export function drawCastMeter(c: CanvasRenderingContext2D, a: Angler, sx: number, sy: number): void {
  const x = Math.max(20, sx - 170);
  const y = sy - 330;
  const w = 46;
  const h = 250;
  frame(c, x, y, w, h);
  const ix = x + 9;
  const iy = y + 12;
  const iw = w - 18;
  const ih = h - 24;
  c.fillStyle = '#2a3442';
  c.beginPath();
  c.roundRect(ix, iy, iw, ih, 8);
  c.fill();
  // the perfect zone
  const pw = a.d.perfectWindow;
  c.fillStyle = '#ffd23a';
  c.fillRect(ix, iy, iw, Math.max(4, ih * pw));
  // the fill
  const p = a.power;
  const g = c.createLinearGradient(0, iy + ih, 0, iy);
  g.addColorStop(0, '#3ac06a');
  g.addColorStop(0.7, '#f0d040');
  g.addColorStop(1, '#ff7a3a');
  c.fillStyle = g;
  c.save();
  c.beginPath();
  c.roundRect(ix, iy, iw, ih, 8);
  c.clip();
  c.fillRect(ix, iy + ih * (1 - p), iw, ih * p);
  c.restore();
  c.strokeStyle = INK;
  c.lineWidth = 3;
  c.beginPath();
  c.roundRect(ix, iy, iw, ih, 8);
  c.stroke();
  if (p >= 1 - pw) {
    c.font = '900 24px "Lilita One", sans-serif';
    c.textAlign = 'center';
    c.lineWidth = 5;
    c.strokeText('PERFECT', x + w / 2, y - 12);
    c.fillStyle = '#ffd23a';
    c.fillText('PERFECT', x + w / 2, y - 12);
  }
}

export function drawHookPrompt(c: CanvasRenderingContext2D, a: Angler, sx: number, sy: number, now: number): void {
  const left = Math.max(0, a.hookLeft / a.d.hookWindow);
  const x = sx;
  const y = sy - 290;
  c.strokeStyle = 'rgba(0,0,0,0.35)';
  c.lineWidth = 10;
  c.beginPath();
  c.arc(x, y, 44, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = left > 0.4 ? '#ffd23a' : '#ff5a4a';
  c.lineWidth = 8;
  c.beginPath();
  c.arc(x, y, 44, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
  c.stroke();
  const s = 1 + Math.sin(now * 20) * 0.06;
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.font = '900 34px "Lilita One", sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineWidth = 6;
  c.strokeStyle = INK;
  c.strokeText('HOOK!', 0, 2);
  c.fillStyle = '#ffffff';
  c.fillText('HOOK!', 0, 2);
  c.restore();
  c.textBaseline = 'alphabetic';
}

function fishIcon(c: CanvasRenderingContext2D, x: number, y: number, legend: boolean, wag: number): void {
  c.save();
  c.translate(x, y);
  c.fillStyle = legend ? '#f5c542' : '#6ab0e0';
  c.strokeStyle = INK;
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(4, 0, 18, 11, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(-12, 0);
  c.lineTo(-24, -10 + wag * 4);
  c.lineTo(-24, 10 + wag * 4);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = INK;
  c.beginPath();
  c.arc(12, -3, 2.8, 0, Math.PI * 2);
  c.fill();
  if (legend) {
    c.fillStyle = '#ffe27a';
    c.beginPath();
    c.moveTo(-4, -10);
    c.lineTo(0, -20);
    c.lineTo(4, -12);
    c.lineTo(8, -20);
    c.lineTo(12, -10);
    c.closePath();
    c.fill();
    c.stroke();
  }
  c.restore();
}

export function drawReel(c: CanvasRenderingContext2D, a: Angler, sx: number, now: number): void {
  const s = a.bar;
  if (!s) return;
  const legend = a.fish?.sp.id === 'marlene';
  const w = 156;
  const h = 560;
  let x = sx + 150;
  if (x + w > 1580) x = sx - 150 - w;
  let y = 150;
  if (!s.inBar && !s.done) {
    x += (Math.random() - 0.5) * 4;
    y += (Math.random() - 0.5) * 4;
  }
  frame(c, x, y, w, h, legend ? '#fff0c8' : '#f6e6c0');
  const tx = x + 18;
  const ty = y + 20;
  const tw = 70;
  const th = h - 40;
  const g = c.createLinearGradient(0, ty, 0, ty + th);
  g.addColorStop(0, legend ? '#3a6a9a' : '#4aa0c8');
  g.addColorStop(1, legend ? '#1a2a4a' : '#1e4a6a');
  c.fillStyle = g;
  c.beginPath();
  c.roundRect(tx, ty, tw, th, 10);
  c.fill();
  // the catch bar
  const by = ty + th * (1 - s.barPos - s.bar);
  const bh = th * s.bar;
  c.fillStyle = s.inBar ? 'rgba(120,255,140,0.92)' : 'rgba(90,200,110,0.6)';
  c.strokeStyle = INK;
  c.lineWidth = 3;
  c.beginPath();
  c.roundRect(tx + 4, by, tw - 8, bh, 8);
  c.fill();
  c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.fillRect(tx + 10, by + 4, 8, Math.max(0, bh - 8));
  // treasure
  const tr = s.treasure;
  if (tr && tr.shown && !tr.got) {
    const cy = ty + th * (1 - tr.pos);
    c.save();
    c.translate(tx + tw / 2, cy);
    c.fillStyle = '#a8682a';
    c.strokeStyle = INK;
    c.lineWidth = 2.5;
    c.beginPath();
    c.roundRect(-14, -10, 28, 20, 4);
    c.fill();
    c.stroke();
    c.fillStyle = '#ffd23a';
    c.fillRect(-14, -3, 28, 5);
    c.strokeRect(-14, -3, 28, 5);
    c.strokeStyle = '#ffd23a';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(0, 0, 21, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * tr.prog);
    c.stroke();
    c.restore();
  } else if (tr?.got) {
    c.font = '900 18px "Lilita One", sans-serif';
    c.fillStyle = '#ffd23a';
    c.textAlign = 'center';
    c.fillText('★', tx + tw / 2, ty + 18);
  }
  // the fish
  fishIcon(c, tx + tw / 2, ty + th * (1 - s.fishPos), legend, Math.sin(now * 16));
  c.strokeStyle = INK;
  c.lineWidth = 3;
  c.beginPath();
  c.roundRect(tx, ty, tw, th, 10);
  c.stroke();
  // the catch meter
  const mx = tx + tw + 16;
  const mw = 34;
  c.fillStyle = '#2a3442';
  c.beginPath();
  c.roundRect(mx, ty, mw, th, 10);
  c.fill();
  const pr = Math.max(0, Math.min(1, s.progress));
  c.fillStyle = pr > 0.66 ? '#5ad06a' : pr > 0.33 ? '#f0c030' : '#f05a4a';
  c.save();
  c.beginPath();
  c.roundRect(mx, ty, mw, th, 10);
  c.clip();
  c.fillRect(mx, ty + th * (1 - pr), mw, th * pr);
  c.restore();
  c.beginPath();
  c.roundRect(mx, ty, mw, th, 10);
  c.stroke();
  if (!s.everLeft) {
    c.font = '900 17px "Lilita One", sans-serif';
    c.textAlign = 'center';
    c.lineWidth = 4;
    c.strokeStyle = INK;
    c.strokeText('PERFECT', x + w / 2, y - 10);
    c.fillStyle = '#7cff9a';
    c.fillText('PERFECT', x + w / 2, y - 10);
  }
}
