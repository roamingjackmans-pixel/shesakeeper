// Dash ornaments, drawn in code on a little base the colour of their tier. Each kind moves its own way when the truck
// hits a bump: bobbleheads nod, hula dancers sway, dice swing, ducks bounce. `w` is the wobble state.
import type { Ornament } from '../core/ornament';
import { ORN_TYPES, TIERS, type OrnType, type Tier } from '../data/perks';
import { shade } from './color';
import { drawFish, INK } from './fishart';
import { FISH } from '../data/fish';

export interface Wob {
  /** angle (radians) and its speed */
  a: number;
  va: number;
  /** bounce height (px) and its speed */
  y: number;
  vy: number;
}

export function newWob(): Wob {
  return { a: 0, va: 0, y: 0, vy: 0 };
}

export function stepWob(w: Wob, dt: number, kind: OrnType): void {
  const wob = ORN_TYPES[kind].wobble;
  const k = wob === 'hang' ? 30 : wob === 'sway' ? 45 : wob === 'tip' ? 18 : 70;
  const damp = wob === 'hang' ? 1.6 : wob === 'tip' ? 1.2 : 3.2;
  w.va += (-k * w.a - damp * w.va) * dt;
  w.a += w.va * dt;
  w.vy += (-260 * w.y - 9 * w.vy) * dt;
  w.y += w.vy * dt;
}

export function bump(w: Wob, strength: number): void {
  w.va += (Math.random() - 0.5) * 6 * strength;
  w.vy -= 60 * strength * (0.6 + Math.random() * 0.6);
}

function base(c: CanvasRenderingContext2D, tier: Tier, now: number): void {
  const t = TIERS[tier];
  c.fillStyle = shade(t.color, -0.25);
  c.strokeStyle = INK;
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(0, 2, 30, 9, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = t.color;
  c.beginPath();
  c.roundRect(-26, -10, 52, 12, 6);
  c.fill();
  c.stroke();
  if (tier === 'gold' || tier === 'pearl' || tier === 'silver') {
    const x = ((now * 30) % 80) - 40;
    c.save();
    c.beginPath();
    c.roundRect(-26, -10, 52, 12, 6);
    c.clip();
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.beginPath();
    c.moveTo(x, -12);
    c.lineTo(x + 8, -12);
    c.lineTo(x + 2, 4);
    c.lineTo(x - 6, 4);
    c.fill();
    c.restore();
  }
}

function spring(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  c.strokeStyle = '#9aa0a8';
  c.lineWidth = 2.5;
  c.beginPath();
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t + (i % 2 ? 4 : -4) * (i > 0 && i < n ? 1 : 0);
    const y = y0 + (y1 - y0) * t;
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.stroke();
}

function circle(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string): void {
  c.fillStyle = fill;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.stroke();
}

/** draw an ornament standing on the current origin (the top of the dash) */
export function drawOrnament(c: CanvasRenderingContext2D, o: Pick<Ornament, 'type' | 'tint' | 'tier'>, w: Wob | null, now: number): void {
  const type = o.type;
  const tint = ORN_TYPES[type].tints[o.tint % ORN_TYPES[type].tints.length]!;
  const a = w?.a ?? 0;
  const by = w ? Math.min(0, w.y) : 0;
  c.save();
  c.lineJoin = 'round';
  c.lineCap = 'round';
  base(c, o.tier, now);
  c.strokeStyle = INK;
  c.lineWidth = 3;
  switch (type) {
    case 'bobble':
    case 'marlene':
    case 'troll':
    case 'turtle':
    case 'bass': {
      // a body, a spring neck, a big nodding head
      if (type === 'turtle') {
        c.fillStyle = tint;
        c.beginPath();
        c.ellipse(0, -22, 24, 15, 0, Math.PI, 0);
        c.closePath();
        c.fill();
        c.stroke();
        c.strokeStyle = shade(tint, -0.4);
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(-12, -24);
        c.lineTo(0, -34);
        c.lineTo(12, -24);
        c.stroke();
        c.strokeStyle = INK;
        c.lineWidth = 3;
      } else if (type === 'bass') {
        c.fillStyle = '#7a5a3a';
        c.beginPath();
        c.roundRect(-14, -22, 28, 14, 4);
        c.fill();
        c.stroke();
      } else {
        c.fillStyle = type === 'marlene' ? '#3a7ad0' : type === 'troll' ? '#a0e0a0' : tint;
        c.beginPath();
        c.roundRect(-13, -36, 26, 28, 8);
        c.fill();
        c.stroke();
      }
      const hx = Math.sin(a) * 14;
      const hy = -52 + Math.abs(Math.sin(a)) * 4 + by * 0.5;
      spring(c, 0, type === 'turtle' ? -30 : -34, hx * 0.6, hy + 12);
      c.save();
      c.translate(hx, hy);
      c.rotate(a * 0.8);
      if (type === 'bass' || type === 'marlene') {
        const sp = FISH[type === 'marlene' ? 'marlene' : 'largemouth']!;
        c.rotate(-0.3);
        if (type === 'bass') {
          const art = { ...sp, art: { ...sp.art, body: tint } };
          drawFish(c, art, 58);
        } else drawFish(c, sp, 62, { glow: true });
      } else if (type === 'turtle') {
        circle(c, 0, 0, 11, shade(tint, 0.2));
        c.fillStyle = INK;
        c.beginPath();
        c.arc(4, -2, 2, 0, Math.PI * 2);
        c.fill();
      } else if (type === 'troll') {
        c.fillStyle = tint;
        for (let i = -4; i <= 4; i++) {
          c.beginPath();
          c.moveTo(i * 3, -10);
          c.quadraticCurveTo(i * 6 + Math.sin(now * 3 + i) * 3, -34, i * 5, -40 - Math.abs(i) * -1);
          c.lineTo(i * 3 + 2, -10);
          c.fill();
        }
        circle(c, 0, 0, 15, '#f0c8a8');
        c.fillStyle = INK;
        c.beginPath();
        c.arc(-5, -1, 2.2, 0, Math.PI * 2);
        c.arc(5, -1, 2.2, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.arc(0, 5, 4, 0.2, Math.PI - 0.2);
        c.stroke();
      } else {
        circle(c, 0, 0, 18, '#f0c8a8');
        c.fillStyle = INK;
        c.beginPath();
        c.arc(-6, -1, 2.4, 0, Math.PI * 2);
        c.arc(6, -1, 2.4, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.arc(0, 5, 6, 0.2, Math.PI - 0.2);
        c.stroke();
        c.fillStyle = tint;
        c.beginPath();
        c.moveTo(-24, -8);
        c.quadraticCurveTo(0, -2, 24, -8);
        c.lineTo(16, -20);
        c.quadraticCurveTo(0, -30, -16, -20);
        c.closePath();
        c.fill();
        c.stroke();
      }
      c.restore();
      break;
    }
    case 'hula': {
      c.save();
      c.translate(0, -10);
      c.rotate(a * 0.6);
      c.fillStyle = '#6aa04a';
      for (let i = -3; i <= 3; i++) {
        c.beginPath();
        c.moveTo(i * 4, -26);
        c.lineTo(i * 6 + Math.sin(now * 6 + i) * 2, 0);
        c.lineTo(i * 6 + 4, 0);
        c.closePath();
        c.fill();
      }
      c.strokeStyle = INK;
      c.fillStyle = '#c88a5a';
      c.beginPath();
      c.roundRect(-8, -50, 16, 26, 6);
      c.fill();
      c.stroke();
      c.rotate(a * 0.5);
      circle(c, 0, -60, 11, '#c88a5a');
      c.fillStyle = '#2a1a12';
      c.beginPath();
      c.arc(0, -62, 11, Math.PI, 0);
      c.fill();
      c.fillStyle = tint;
      for (let i = 0; i < 6; i++) {
        c.beginPath();
        c.arc(-8 + i * 3.2, -46 + Math.abs(i - 2.5) * 1.5, 3.2, 0, Math.PI * 2);
        c.fill();
      }
      c.strokeStyle = '#c88a5a';
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(-8, -46);
      c.quadraticCurveTo(-22, -54 + Math.sin(now * 5) * 4, -18, -64);
      c.moveTo(8, -46);
      c.quadraticCurveTo(22, -54 - Math.sin(now * 5) * 4, 18, -64);
      c.stroke();
      c.restore();
      break;
    }
    case 'dice':
    case 'pine': {
      // a little hook stand, the thing hanging from it
      c.strokeStyle = INK;
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(-14, -8);
      c.lineTo(-14, -78);
      c.lineTo(8, -78);
      c.stroke();
      c.save();
      c.translate(8, -76);
      c.rotate(a);
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, 24);
      c.stroke();
      c.lineWidth = 3;
      if (type === 'dice') {
        for (const [dx, rot] of [
          [-9, -0.2],
          [9, 0.25],
        ] as const) {
          c.save();
          c.translate(dx, 36);
          c.rotate(rot + Math.sin(now * 2 + dx) * 0.05);
          c.fillStyle = tint;
          c.beginPath();
          c.roundRect(-11, -11, 22, 22, 6);
          c.fill();
          c.stroke();
          c.fillStyle = tint === '#f0f0f0' ? INK : '#ffffff';
          for (const [px, py] of [
            [-5, -5],
            [5, 5],
            [0, 0],
          ])
            c.fillRect(px - 2, py - 2, 4, 4);
          c.restore();
        }
      } else {
        c.fillStyle = tint;
        c.beginPath();
        c.moveTo(0, 22);
        c.lineTo(-16, 46);
        c.lineTo(-8, 46);
        c.lineTo(-20, 64);
        c.lineTo(20, 64);
        c.lineTo(8, 46);
        c.lineTo(16, 46);
        c.closePath();
        c.fill();
        c.stroke();
        c.fillStyle = '#7a5a3a';
        c.fillRect(-3, 64, 6, 8);
      }
      c.restore();
      break;
    }
    case 'bird': {
      c.strokeStyle = INK;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-16, -8);
      c.lineTo(-10, -40);
      c.moveTo(16, -8);
      c.lineTo(10, -40);
      c.stroke();
      c.save();
      c.translate(0, -40);
      c.rotate(a * 1.3 + Math.sin(now * 0.8) * 0.5);
      c.fillStyle = 'rgba(200,230,255,0.6)';
      circle(c, 0, 10, 10, tint);
      c.fillStyle = 'rgba(220,240,255,0.7)';
      c.beginPath();
      c.roundRect(-3, -36, 6, 46, 3);
      c.fill();
      c.stroke();
      circle(c, 0, -42, 10, tint);
      c.fillStyle = INK;
      c.fillRect(-9, -60, 18, 10);
      c.fillRect(-13, -51, 26, 3);
      c.fillStyle = '#f0a030';
      c.beginPath();
      c.moveTo(8, -42);
      c.lineTo(20, -40);
      c.lineTo(8, -37);
      c.fill();
      c.stroke();
      c.restore();
      break;
    }
    case 'cat': {
      c.fillStyle = tint;
      c.beginPath();
      c.roundRect(-18, -46, 36, 38, 12);
      c.fill();
      c.stroke();
      circle(c, 0, -56, 16, tint);
      c.beginPath();
      c.moveTo(-14, -64);
      c.lineTo(-12, -78);
      c.lineTo(-4, -70);
      c.moveTo(14, -64);
      c.lineTo(12, -78);
      c.lineTo(4, -70);
      c.fill();
      c.stroke();
      c.fillStyle = INK;
      c.beginPath();
      c.arc(-6, -57, 2.2, 0, Math.PI * 2);
      c.arc(6, -57, 2.2, 0, Math.PI * 2);
      c.fill();
      c.save();
      c.translate(16, -40);
      c.rotate(-0.6 + Math.sin(now * 4) * 0.5 + a);
      c.fillStyle = tint;
      c.beginPath();
      c.roundRect(-5, -26, 10, 26, 5);
      c.fill();
      c.stroke();
      c.restore();
      c.fillStyle = '#e8402a';
      c.fillRect(-16, -42, 32, 4);
      c.fillStyle = '#f0c830';
      circle(c, 0, -34, 4, '#f0c830');
      break;
    }
    case 'duck': {
      c.save();
      c.translate(0, by);
      c.fillStyle = tint;
      c.beginPath();
      c.ellipse(0, -22, 22, 14, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      circle(c, 10, -44, 12, tint);
      c.fillStyle = '#f07a2a';
      c.beginPath();
      c.ellipse(24, -42, 8, 4, 0.1, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = INK;
      c.beginPath();
      c.arc(14, -47, 2.2, 0, Math.PI * 2);
      c.fill();
      c.restore();
      break;
    }
    case 'flower': {
      c.fillStyle = '#c86a3a';
      c.beginPath();
      c.moveTo(-14, -8);
      c.lineTo(-11, -26);
      c.lineTo(11, -26);
      c.lineTo(14, -8);
      c.closePath();
      c.fill();
      c.stroke();
      c.save();
      c.translate(0, -26);
      c.rotate(a + Math.sin(now * 3) * 0.25);
      c.strokeStyle = '#3a8a3a';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, -32);
      c.stroke();
      c.strokeStyle = INK;
      c.lineWidth = 2.5;
      c.fillStyle = tint;
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        c.beginPath();
        c.ellipse(Math.cos(ang) * 13, -44 + Math.sin(ang) * 13, 7, 5, ang, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
      circle(c, 0, -44, 10, '#f8e08a');
      c.fillStyle = INK;
      c.fillRect(-8, -48, 7, 4);
      c.fillRect(1, -48, 7, 4);
      c.beginPath();
      c.arc(0, -40, 4, 0.2, Math.PI - 0.2);
      c.stroke();
      c.restore();
      break;
    }
    case 'compass': {
      c.fillStyle = tint;
      c.beginPath();
      c.roundRect(-18, -20, 36, 12, 4);
      c.fill();
      c.stroke();
      c.fillStyle = 'rgba(220,240,255,0.85)';
      c.beginPath();
      c.arc(0, -20, 18, Math.PI, 0);
      c.closePath();
      c.fill();
      c.stroke();
      c.save();
      c.translate(0, -24);
      c.rotate(a * 2 + Math.sin(now * 1.3) * 0.2);
      c.fillStyle = '#e84a4a';
      c.beginPath();
      c.moveTo(0, -11);
      c.lineTo(3, 0);
      c.lineTo(-3, 0);
      c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(0, 11);
      c.lineTo(3, 0);
      c.lineTo(-3, 0);
      c.fill();
      c.restore();
      break;
    }
    case 'lighthouse': {
      c.save();
      c.translate(0, by);
      c.fillStyle = '#f4f4f4';
      c.beginPath();
      c.moveTo(-14, -8);
      c.lineTo(-9, -64);
      c.lineTo(9, -64);
      c.lineTo(14, -8);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = tint;
      c.fillRect(-12, -28, 24, 9);
      c.fillRect(-10, -50, 20, 8);
      c.fillStyle = Math.sin(now * 3) > 0 ? '#fff6a0' : '#a89a60';
      c.beginPath();
      c.roundRect(-8, -78, 16, 14, 3);
      c.fill();
      c.stroke();
      c.fillStyle = tint;
      c.beginPath();
      c.moveTo(-10, -78);
      c.lineTo(0, -88);
      c.lineTo(10, -78);
      c.fill();
      c.stroke();
      c.restore();
      break;
    }
    case 'globe': {
      c.fillStyle = '#5a3a2a';
      c.beginPath();
      c.roundRect(-18, -18, 36, 12, 4);
      c.fill();
      c.stroke();
      c.fillStyle = 'rgba(200,235,255,0.55)';
      circle(c, 0, -40, 24, 'rgba(200,235,255,0.55)');
      c.fillStyle = tint;
      c.beginPath();
      c.moveTo(0, -56);
      c.lineTo(-10, -32);
      c.lineTo(10, -32);
      c.closePath();
      c.fill();
      c.fillStyle = '#ffffff';
      for (let i = 0; i < 10; i++) {
        const t = (now * 0.4 + i * 0.13) % 1;
        c.fillRect(-16 + ((i * 37) % 32), -60 + t * 38, 2, 2);
      }
      break;
    }
    case 'ball': {
      c.save();
      c.translate(0, by);
      circle(c, 0, -32, 22, tint);
      c.fillStyle = 'rgba(255,255,255,0.3)';
      c.beginPath();
      c.ellipse(-8, -42, 8, 4, -0.6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#3a5ad0';
      c.beginPath();
      c.moveTo(0, -40);
      c.lineTo(8, -26);
      c.lineTo(-8, -26);
      c.closePath();
      c.fill();
      c.restore();
      break;
    }
    case 'cactus': {
      c.save();
      c.translate(0, by);
      c.fillStyle = '#c86a3a';
      c.beginPath();
      c.moveTo(-15, -8);
      c.lineTo(-12, -24);
      c.lineTo(12, -24);
      c.lineTo(15, -8);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = tint;
      c.beginPath();
      c.roundRect(-8, -64, 16, 42, 8);
      c.roundRect(-22, -50, 10, 20, 5);
      c.roundRect(12, -56, 10, 22, 5);
      c.fill();
      c.stroke();
      c.fillStyle = '#f08ab0';
      circle(c, 0, -66, 5, '#f08ab0');
      c.restore();
      break;
    }
    case 'frog': {
      const sy = Math.min(0, by) - 6;
      spring(c, 0, -8, 0, -18 + sy);
      c.save();
      c.translate(0, sy);
      c.fillStyle = tint;
      c.beginPath();
      c.ellipse(0, -28, 20, 14, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      circle(c, -9, -42, 7, tint);
      circle(c, 9, -42, 7, tint);
      c.fillStyle = INK;
      c.beginPath();
      c.arc(-9, -43, 3, 0, Math.PI * 2);
      c.arc(9, -43, 3, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.arc(0, -28, 8, 0.2, Math.PI - 0.2);
      c.stroke();
      c.restore();
      break;
    }
  }
  c.restore();
}

const ornCache = new Map<string, string>();

/** a data-URL picture of an ornament, for menus (cached) */
export function ornamentImage(o: Pick<Ornament, 'type' | 'tint' | 'tier'>, size = 96): string {
  const key = `${o.type}:${o.tint}:${o.tier}:${size}`;
  const hit = ornCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = size * 2;
  c.height = size * 2;
  const x = c.getContext('2d')!;
  x.scale((size * 2) / 110, (size * 2) / 110);
  x.translate(55, 96);
  drawOrnament(x, o, null, 0.3);
  const url = c.toDataURL();
  ornCache.set(key, url);
  return url;
}
