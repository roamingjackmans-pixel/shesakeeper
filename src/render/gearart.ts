// Little pictures of rods, lures and bait for the menus (drawn once, cached as data URLs).
import { GEAR, type Gear } from '../data/gear';
import { INK } from './fishart';

function rod(c: CanvasRenderingContext2D, g: Gear): void {
  c.strokeStyle = INK;
  c.lineWidth = 7;
  c.beginPath();
  c.moveTo(14, 86);
  c.lineTo(86, 12);
  c.stroke();
  c.strokeStyle = g.color;
  c.lineWidth = 4;
  c.stroke();
  c.strokeStyle = INK;
  c.lineWidth = 9;
  c.beginPath();
  c.moveTo(10, 90);
  c.lineTo(28, 72);
  c.stroke();
  c.strokeStyle = g.accent;
  c.lineWidth = 6;
  c.stroke();
  c.fillStyle = '#b0b6c0';
  c.strokeStyle = INK;
  c.lineWidth = 2.5;
  c.beginPath();
  c.arc(34, 72, 9, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.8)';
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(86, 12);
  c.quadraticCurveTo(92, 50, 80, 70);
  c.stroke();
  if (g.id === 'glow' || g.id === 'keeper' || g.id === 'golden') {
    c.fillStyle = g.accent;
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.arc(30 + i * 15, 64 - i * 15, 2.5, 0, Math.PI * 2);
      c.fill();
    }
  }
}

function lure(c: CanvasRenderingContext2D, g: Gear): void {
  c.strokeStyle = INK;
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(50, 4);
  c.lineTo(50, 22);
  c.stroke();
  c.lineJoin = 'round';
  switch (g.id) {
    case 'bobber':
    case 'cork':
    case 'lead':
    case 'trap':
    case 'bubble':
      c.fillStyle = g.accent;
      c.beginPath();
      c.arc(50, 50, 26, 0, Math.PI);
      c.fill();
      c.stroke();
      c.fillStyle = g.color;
      c.beginPath();
      c.arc(50, 50, 26, Math.PI, 0);
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(50, 24);
      c.lineTo(50, 14);
      c.stroke();
      break;
    case 'spinner':
    case 'spoon':
      c.fillStyle = g.color;
      c.beginPath();
      c.ellipse(50, 50, 14, 26, 0.3, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = g.accent;
      c.beginPath();
      c.ellipse(50, 50, 6, 14, 0.3, 0, Math.PI * 2);
      c.fill();
      break;
    case 'feather':
      c.fillStyle = g.color;
      c.beginPath();
      c.moveTo(50, 22);
      c.quadraticCurveTo(80, 50, 54, 88);
      c.quadraticCurveTo(30, 50, 50, 22);
      c.fill();
      c.stroke();
      c.strokeStyle = g.accent;
      c.beginPath();
      c.moveTo(50, 26);
      c.lineTo(54, 84);
      c.stroke();
      break;
    case 'glowsquid':
      c.fillStyle = g.color;
      c.beginPath();
      c.ellipse(50, 40, 16, 20, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.strokeStyle = g.accent;
      c.lineWidth = 3;
      for (let i = -2; i <= 2; i++) {
        c.beginPath();
        c.moveTo(50 + i * 5, 58);
        c.quadraticCurveTo(50 + i * 9, 74, 50 + i * 6, 90);
        c.stroke();
      }
      break;
    case 'treasure':
      c.fillStyle = g.color;
      c.beginPath();
      c.moveTo(30, 40);
      c.lineTo(30, 70);
      c.quadraticCurveTo(50, 90, 70, 70);
      c.lineTo(70, 40);
      c.lineTo(58, 40);
      c.lineTo(58, 66);
      c.lineTo(42, 66);
      c.lineTo(42, 40);
      c.closePath();
      c.fill();
      c.stroke();
      break;
    case 'barbed':
      c.strokeStyle = g.color;
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(50, 22);
      c.lineTo(50, 66);
      c.quadraticCurveTo(50, 86, 34, 80);
      c.lineTo(32, 64);
      c.stroke();
      c.strokeStyle = g.accent;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(32, 64);
      c.lineTo(40, 70);
      c.stroke();
      break;
    default:
      // a fishy plug: popper, crank, jig
      c.fillStyle = g.color;
      c.beginPath();
      c.ellipse(52, 52, 30, 15, 0.5, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = g.accent;
      c.beginPath();
      c.ellipse(60, 44, 10, 5, 0.5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(68, 62, 5, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.strokeStyle = INK;
      c.beginPath();
      c.moveTo(34, 64);
      c.lineTo(28, 80);
      c.moveTo(60, 76);
      c.lineTo(58, 90);
      c.stroke();
  }
}

function bait(c: CanvasRenderingContext2D, g: Gear): void {
  // a tin with a label
  c.fillStyle = '#9aa0a8';
  c.strokeStyle = INK;
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(50, 30, 34, 10, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(16, 30);
  c.lineTo(16, 74);
  c.quadraticCurveTo(50, 90, 84, 74);
  c.lineTo(84, 30);
  c.fill();
  c.stroke();
  c.fillStyle = g.color;
  c.beginPath();
  c.moveTo(16, 42);
  c.lineTo(16, 64);
  c.quadraticCurveTo(50, 76, 84, 64);
  c.lineTo(84, 42);
  c.quadraticCurveTo(50, 54, 16, 42);
  c.fill();
  c.stroke();
  // what's in it, poking out of the top
  c.fillStyle = g.accent;
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.ellipse(30 + i * 13, 26 - (i % 2) * 5, 8, 5, i, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
}

const cache = new Map<string, HTMLCanvasElement>();

/** a piece of gear, drawn once into a hidden canvas, sharp up to 110 px on screen (pages copy it: render/pics.ts) */
export function gearSprite(id: string): HTMLCanvasElement {
  const key = id;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 110;
  const g = GEAR[id];
  const c = document.createElement('canvas');
  c.width = size * 2;
  c.height = size * 2;
  const x = c.getContext('2d')!;
  x.scale((size * 2) / 100, (size * 2) / 100);
  x.lineCap = 'round';
  if (g) {
    if (g.kind === 'rod') rod(x, g);
    else if (g.kind === 'lure') lure(x, g);
    else bait(x, g);
  }
  cache.set(key, c);
  return c;
}
