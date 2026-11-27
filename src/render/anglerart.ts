// The angler, seen from behind on the shore: boots, jeans, a fishing vest, hair, a hat, and the rod, which moves
// with what they're doing. Returns where the rod tip is so the line can be drawn from it.
import type { AnglerLook } from '../core/types';
import { drawFish, INK } from './fishart';
import { FISH } from '../data/fish';
import { shade } from './color';

export const HATS = ['Bucket Hat', 'Ball Cap', 'Cowboy Hat', 'Beanie', 'Straw Sun Hat', 'Captain’s Cap'];
export const HAT_COLORS = ['#d8b86a', '#e84a4a', '#3a7ad0', '#3aa06a', '#f0a030', '#8a4ad0', '#2a2a2a', '#f0f0f0'];
export const JACKETS = ['#3a6a4a', '#c84a3a', '#2a5a8a', '#d89a3a', '#6a4a8a', '#3a8a8a', '#8a8a3a', '#d85a8a'];
export const SKINS = ['#f4d4b8', '#e8b890', '#c88a5a', '#a86a42', '#7a4a2a', '#5a341e'];
export const HAIRS = ['#3a2418', '#8a5a2a', '#e8c86a', '#c84a2a', '#2a2a2a', '#d8d8d8'];

export type Pose = 'idle' | 'charge' | 'cast' | 'wait' | 'bite' | 'reel' | 'hold' | 'done';

export interface PoseArgs {
  pose: Pose;
  /** -1..1 aim (radians-ish) */
  aim: number;
  power: number;
  /** seconds in pose */
  pt: number;
  now: number;
  /** 0..1 fish height on the reel, for the rod's tug */
  fy: number;
  /** the fish held up when showing a catch */
  fish?: string;
  fishCm?: number;
  /** screen point the line pulls toward (for rod bend) */
  pull?: { x: number; y: number };
  /** walking (a step cycle), shoving someone (-1 left / 1 right), wobbling from a shove */
  walk?: number;
  push?: number;
  jolt?: number;
}

/** draws at the current transform's origin = between the feet, `s` = scale; returns the rod tip in local units */
export function drawAngler(c: CanvasRenderingContext2D, look: AnglerLook, p: PoseArgs): { tx: number; ty: number } {
  const jacket = JACKETS[look.jacket % JACKETS.length]!;
  const skin = SKINS[look.skin % SKINS.length]!;
  const hair = HAIRS[look.hair % HAIRS.length]!;
  const hatC = HAT_COLORS[look.hatColor % HAT_COLORS.length]!;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.strokeStyle = INK;
  c.lineWidth = 3;
  // walking: legs take turns lifting; a shove leans the whole angler; being shoved wobbles them
  const step = p.walk ? Math.sin(p.now * 14) : 0;
  const bob = Math.sin(p.now * 2) * 1.2 - (p.walk ? Math.abs(step) * 2.5 : 0);
  const tilt = (p.push ? p.push * 0.24 : 0) + (p.jolt ? Math.sin(p.now * 32) * 0.08 : 0);
  // shadow
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.beginPath();
  c.ellipse(0, 2, 34, 8, 0, 0, Math.PI * 2);
  c.fill();
  c.save();
  c.rotate(tilt);
  // legs + boots
  const lL = Math.max(0, step) * 7;
  const lR = Math.max(0, -step) * 7;
  c.fillStyle = '#3a4a6a';
  c.beginPath();
  c.roundRect(-22, -58, 19, 54 - lL, 5);
  c.roundRect(3, -58, 19, 54 - lR, 5);
  c.fill();
  c.stroke();
  c.fillStyle = '#4a3020';
  c.beginPath();
  c.roundRect(-24, -12 - lL, 22, 13, 4);
  c.roundRect(2, -12 - lR, 22, 13, 4);
  c.fill();
  c.stroke();
  // rod angle (from vertical, + leans right)
  let th = 0.18 + p.aim * 0.55;
  let len = 190;
  let bend = 0;
  let armsUp = false;
  switch (p.pose) {
    case 'charge':
      th = 0.25 + p.power * 1.35;
      len = 190 - p.power * 55;
      break;
    case 'cast': {
      const u = Math.min(1, p.pt / 0.18);
      th = 1.6 - u * (1.6 - (0.12 + p.aim * 0.55));
      break;
    }
    case 'wait':
      th = 0.12 + p.aim * 0.55 + Math.sin(p.now * 1.3) * 0.02;
      break;
    case 'bite':
      th = 0.12 + p.aim * 0.55 + Math.sin(p.now * 40) * 0.04;
      bend = 0.35;
      break;
    case 'reel':
      th = -0.05 + p.aim * 0.4 + (p.fy - 0.5) * 0.25 + Math.sin(p.now * 23) * 0.02;
      bend = 0.75;
      len = 180;
      break;
    case 'hold':
      armsUp = true;
      th = -0.9;
      len = 150;
      break;
    default:
      th = 0.22 + Math.sin(p.now * 1.1) * 0.03;
  }
  // Seen from behind, the hands are out in front of the body, out of sight: the rod starts there, so its butt is
  // hidden by the body and only the part rising past the shoulder shows. Pulled back to cast, it comes over the
  // right shoulder toward us instead.
  const charging = p.pose === 'charge';
  const rx = charging ? 16 : 10;
  const ry = charging ? -118 + bob : -92 + bob;
  const tx = rx + Math.sin(th) * len;
  const ty = ry - Math.cos(th) * len;
  const mx = (rx + tx) / 2 + (p.pull ? Math.sign(p.pull.x - tx) * bend * 26 : bend * 20);
  const my = (ry + ty) / 2 + bend * 30;
  const drawRod = () => {
    c.strokeStyle = INK;
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(rx, ry);
    c.quadraticCurveTo(mx, my, tx, ty);
    c.stroke();
    c.strokeStyle = '#d8b86a';
    c.lineWidth = 3;
    c.stroke();
    c.lineWidth = 3;
  };
  if (!charging) drawRod();
  // body: vest over a jacket
  c.fillStyle = jacket;
  c.beginPath();
  c.moveTo(-30, -58);
  c.quadraticCurveTo(-34, -100 + bob, -24, -122 + bob);
  c.lineTo(24, -122 + bob);
  c.quadraticCurveTo(34, -100 + bob, 30, -58);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = shade(jacket, -0.25);
  c.beginPath();
  c.roundRect(-20, -112 + bob, 40, 50, 6);
  c.fill();
  c.stroke();
  // vest pockets
  c.fillStyle = shade(jacket, -0.1);
  c.lineWidth = 2;
  c.beginPath();
  c.roundRect(-16, -96 + bob, 13, 12, 2);
  c.roundRect(3, -96 + bob, 13, 12, 2);
  c.fill();
  c.stroke();
  c.lineWidth = 3;
  // arms: sleeves only (the hands are in front, out of sight)
  const sleeve = (x0: number, y0: number, x1: number, y1: number) => {
    c.lineWidth = 15;
    c.strokeStyle = INK;
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
    c.lineWidth = 10;
    c.strokeStyle = jacket;
    c.stroke();
    c.lineWidth = 3;
    c.strokeStyle = INK;
  };
  if (armsUp) {
    // holding the catch up over the head: forearms up, the fish in front of the hands
    sleeve(-24, -116 + bob, -32, -150);
    sleeve(-32, -150, -26, -176);
    sleeve(24, -116 + bob, 32, -150);
    sleeve(32, -150, 26, -176);
  } else if (charging) {
    sleeve(-24, -116 + bob, -30, -86 + bob);
    sleeve(24, -116 + bob, 30, -128 + bob);
  } else {
    // elbows out a little, forearms reaching forward out of sight
    sleeve(-24, -116 + bob, -31, -88 + bob);
    sleeve(24, -116 + bob, 31, -88 + bob);
  }
  // the back of the head: a bit of neck, the ears, and hair (no face: the angler looks out over the water)
  c.fillStyle = skin;
  c.beginPath();
  c.roundRect(-8, -124 + bob, 16, 10, 3);
  c.fill();
  c.stroke();
  c.beginPath();
  c.arc(-20, -136 + bob, 5, 0, Math.PI * 2);
  c.arc(20, -136 + bob, 5, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = hair;
  c.beginPath();
  c.arc(0, -138 + bob, 21, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // a few strands
  c.strokeStyle = shade(hair, -0.3);
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-8, -150 + bob);
  c.quadraticCurveTo(-10, -136 + bob, -6, -122 + bob);
  c.moveTo(7, -150 + bob);
  c.quadraticCurveTo(10, -136 + bob, 5, -122 + bob);
  c.stroke();
  c.strokeStyle = INK;
  c.lineWidth = 3;
  drawHat(c, look.hat % HATS.length, hatC, -150 + bob);
  // pulled back over the shoulder, the rod is in front of everything
  if (charging) drawRod();
  if (armsUp && p.fish && FISH[p.fish]) {
    const sp = FISH[p.fish]!;
    const L = Math.max(60, Math.min(240, (p.fishCm ?? 30) * 1.4));
    c.save();
    c.translate(0, -180 - Math.min(30, L * 0.08));
    c.rotate(Math.sin(p.now * 9) * 0.08);
    drawFish(c, sp, L, { wag: Math.sin(p.now * 14), glow: sp.id === 'marlene' });
    c.restore();
  }
  c.restore();
  // the rod tip, turned with the lean
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  return { tx: tx * ct - ty * st, ty: tx * st + ty * ct };
}

function drawHat(c: CanvasRenderingContext2D, hat: number, col: string, y: number): void {
  c.fillStyle = col;
  c.strokeStyle = INK;
  c.lineWidth = 3;
  c.beginPath();
  switch (hat) {
    case 0: // bucket hat
      c.moveTo(-30, y + 10);
      c.quadraticCurveTo(0, y + 18, 30, y + 10);
      c.lineTo(22, y - 4);
      c.quadraticCurveTo(0, y - 16, -22, y - 4);
      c.closePath();
      break;
    case 1: // cap from behind: crown and the strap gap
      c.arc(0, y + 6, 22, Math.PI, 0);
      c.closePath();
      break;
    case 2: // cowboy
      c.ellipse(0, y + 8, 40, 9, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(-18, y + 6);
      c.quadraticCurveTo(-20, y - 22, 0, y - 16);
      c.quadraticCurveTo(20, y - 22, 18, y + 6);
      c.closePath();
      break;
    case 3: // beanie with a pom
      c.arc(0, y + 8, 22, Math.PI, 0);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = shade(col, 0.4);
      c.beginPath();
      c.arc(0, y - 16, 7, 0, Math.PI * 2);
      break;
    case 4: // straw sun hat
      c.ellipse(0, y + 8, 46, 11, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.beginPath();
      c.arc(0, y + 6, 19, Math.PI, 0);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = '#e84a4a';
      c.beginPath();
      c.rect(-19, y + 1, 38, 5);
      break;
    default: // captain's cap
      c.roundRect(-22, y - 8, 44, 18, 5);
      c.fill();
      c.stroke();
      c.fillStyle = '#f0f0f0';
      c.beginPath();
      c.rect(-22, y + 4, 44, 6);
  }
  c.fill();
  c.stroke();
  if (hat === 1) {
    c.fillStyle = '#f4f0e8';
    c.beginPath();
    c.roundRect(-8, y - 1, 16, 7, 3);
    c.fill();
    c.stroke();
  }
}
