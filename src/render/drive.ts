// The drive to each fishing hole, from inside the truck: the road and the country rolling by, a sign with the next
// mission, the radio, and the dash, where every angler's three ornaments ride and jiggle over every bump.
import type { Ornament } from '../core/ornament';
import type { HoleSpec } from '../core/types';
import { BIOMES } from '../data/spots';
import { alpha, mix, shade, skyFor } from './color';
import { layer, pixelRatio, type Scene } from './canvas';
import { INK } from './fishart';
import { bump, drawOrnament, newWob, stepWob, type Wob } from './ornart';

export interface DashSection {
  name: string;
  color: string;
  ornaments: (Ornament | null)[];
}

const W = 1600;
const H = 900;
const VP = { x: 800, y: 350 };
const ROAD_Y = 640;
const FRAME = '#1e2026';
/** where the dash layer starts, and how tall the roof strip is */
const DASH_Y = 600;
const TOP_H = 140;

function dashTop(x: number): number {
  const u = (x - 800) / 800;
  return 612 + u * u * 46;
}

interface Thing {
  side: number;
  z: number;
  kind: 'tree' | 'pole' | 'bush' | 'rock' | 'cactus' | 'reed';
  off: number;
}

export class DriveScene implements Scene {
  t = 0;
  readonly dur: number;
  private wobs: Wob[][] = [];
  private things: Thing[] = [];
  private nextBump = 0.6;
  private shakeY = 0;
  private bg: HTMLCanvasElement | null = null;
  private dash: HTMLCanvasElement | null = null;
  private top: HTMLCanvasElement | null = null;
  private radioStrip: HTMLCanvasElement | null = null;
  private radioW = 1;
  private dashFor = '';
  private signZ = 34;
  private dashScroll = 0;
  /** ornament hit boxes this frame (for clicks) */
  hits: { x: number; y: number; w: number; h: number; si: number; oi: number }[] = [];

  constructor(
    public to: HoleSpec | null,
    public sections: DashSection[],
    public radio: string,
    dur = 9,
  ) {
    this.dur = dur;
    this.setSections(sections);
    for (let i = 0; i < 26; i++) this.things.push(this.newThing(Math.random() * 30));
  }

  setSections(s: DashSection[]): void {
    this.sections = s;
    this.wobs = s.map((sec, i) => sec.ornaments.map((_, j) => this.wobs[i]?.[j] ?? newWob()));
    this.dash = null;
  }

  private newThing(z: number): Thing {
    const b = this.to?.biome ?? 'lake';
    const kinds: Thing['kind'][] = b === 'coast' ? ['pole', 'bush', 'rock'] : b === 'swamp' ? ['tree', 'reed', 'pole'] : b === 'tarn' ? ['tree', 'rock', 'tree'] : ['tree', 'tree', 'pole', 'bush'];
    return { side: Math.random() < 0.5 ? -1 : 1, z, kind: kinds[Math.floor(Math.random() * kinds.length)]!, off: 80 + Math.random() * 500 };
  }

  resize(): void {
    this.bg = null;
    this.dash = null;
    this.top = null;
    this.radioStrip = null;
  }

  flick(si: number, oi: number): void {
    const w = this.wobs[si]?.[oi];
    if (w) bump(w, 2.2);
  }

  private palette() {
    const sky = skyFor(this.to?.time ?? 'dusk', this.to?.weather ?? 'clear');
    const b = this.to?.biome ?? 'lake';
    const ground = b === 'ice' ? '#e4eef6' : b === 'coast' ? '#d8c890' : b === 'swamp' ? '#5a6a3a' : b === 'tarn' ? '#6a8a5a' : '#5a8a44';
    return { sky, ground: mix(mix(ground, sky.tint, sky.tintA), '#0a1030', sky.dark * 0.55), b };
  }

  private buildBg(): void {
    const { sky, ground, b } = this.palette();
    this.bg = layer(W, ROAD_Y + 40, (c) => {
      const g = c.createLinearGradient(0, 0, 0, VP.y + 20);
      g.addColorStop(0, sky.top);
      g.addColorStop(0.7, sky.mid);
      g.addColorStop(1, sky.low);
      c.fillStyle = g;
      c.fillRect(0, 0, W, VP.y + 30);
      c.fillStyle = alpha(sky.sun, 0.9);
      c.beginPath();
      c.arc(sky.sunX * 0.8 + 100, Math.min(sky.sunY, VP.y - 60), 40, 0, Math.PI * 2);
      c.fill();
      // hills
      const hill = (col: string, y0: number, amp: number, f: number, ph: number) => {
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(0, VP.y + 30);
        for (let x = 0; x <= W; x += 16) c.lineTo(x, y0 - Math.abs(Math.sin(x * f + ph)) * amp);
        c.lineTo(W, VP.y + 30);
        c.fill();
      };
      const far = b === 'tarn' ? '#6a7a9a' : b === 'ice' ? '#c8d8e8' : b === 'coast' ? '#6a9ab8' : '#5a7a6a';
      hill(mix(far, sky.haze, 0.5), VP.y - 10, b === 'tarn' ? 160 : 60, 0.004, 1);
      hill(mix(shade(ground, -0.15), sky.haze, 0.3), VP.y + 6, 30, 0.007, 3);
      c.fillStyle = ground;
      c.fillRect(0, VP.y + 4, W, ROAD_Y - VP.y + 40);
      // the destination's water on the horizon
      const wcol = BIOMES[b].water[1];
      c.fillStyle = mix(wcol, sky.low, 0.35);
      c.beginPath();
      c.ellipse(VP.x + 260, VP.y + 8, 240, 10, 0, 0, Math.PI * 2);
      c.fill();
      // the road
      c.fillStyle = '#3a3a40';
      c.beginPath();
      c.moveTo(VP.x - 8, VP.y);
      c.lineTo(VP.x + 8, VP.y);
      c.lineTo(W * 0.95, ROAD_Y + 40);
      c.lineTo(W * 0.05, ROAD_Y + 40);
      c.closePath();
      c.fill();
      c.strokeStyle = '#e8e0c0';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(VP.x - 8, VP.y);
      c.lineTo(W * 0.05 + 30, ROAD_Y + 40);
      c.moveTo(VP.x + 8, VP.y);
      c.lineTo(W * 0.95 - 30, ROAD_Y + 40);
      c.stroke();
    });
  }

  private buildDash(): void {
    this.dashFor = this.sections.map((s) => s.name).join('|');
    // the roof edge and the mirror: a strip across the top (small, mostly opaque)
    this.top = layer(W, TOP_H, (c) => {
      c.fillStyle = FRAME;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(W, 0);
      c.lineTo(W, TOP_H);
      c.lineTo(W - 70, TOP_H);
      c.lineTo(W - 70, 70);
      c.quadraticCurveTo(W / 2, 30, 70, 70);
      c.lineTo(70, TOP_H);
      c.lineTo(0, TOP_H);
      c.closePath();
      c.fill();
      c.fillStyle = '#2a2c34';
      c.fillRect(W / 2 - 6, 40, 12, 40);
      c.beginPath();
      c.roundRect(W / 2 - 130, 72, 260, 58, 18);
      c.fill();
      const mg = c.createLinearGradient(0, 80, 0, 124);
      mg.addColorStop(0, '#8aa0b8');
      mg.addColorStop(1, '#4a5a6a');
      c.fillStyle = mg;
      c.beginPath();
      c.roundRect(W / 2 - 118, 80, 236, 42, 12);
      c.fill();
    });
    // the dash itself: only the bottom of the screen (a full-screen layer, mostly see-through, cost a full-screen blit
    // every frame)
    this.dash = layer(W, H - DASH_Y, (c) => {
      c.translate(0, -DASH_Y);
      c.fillStyle = FRAME;
      c.fillRect(0, 640, W, 40);
      // the dash
      c.fillStyle = '#2e3a40';
      c.strokeStyle = INK;
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(0, dashTop(0));
      for (let x = 0; x <= W; x += 20) c.lineTo(x, dashTop(x));
      c.lineTo(W, H);
      c.lineTo(0, H);
      c.closePath();
      c.fill();
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.12)';
      c.lineWidth = 4;
      c.beginPath();
      for (let x = 0; x <= W; x += 20) (x ? c.lineTo(x, dashTop(x) + 8) : c.moveTo(x, dashTop(x) + 8));
      c.stroke();
      // vents and the radio
      c.fillStyle = '#1e262a';
      c.beginPath();
      c.roundRect(W / 2 - 170, 740, 340, 92, 14);
      c.fill();
      c.fillStyle = '#0e1612';
      c.beginPath();
      c.roundRect(W / 2 - 150, 756, 300, 40, 8);
      c.fill();
      for (const kx of [W / 2 - 120, W / 2 + 120]) {
        c.fillStyle = '#9aa0a8';
        c.beginPath();
        c.arc(kx, 812, 11, 0, Math.PI * 2);
        c.fill();
      }
      // gauges
      for (const gx of [250, 400]) {
        c.fillStyle = '#12181c';
        c.beginPath();
        c.arc(gx, 770, 62, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#5a6a72';
        c.lineWidth = 4;
        c.stroke();
        c.strokeStyle = '#d8e0e8';
        c.lineWidth = 2;
        for (let i = 0; i <= 8; i++) {
          const a = Math.PI * 0.8 + (i / 8) * Math.PI * 1.4;
          c.beginPath();
          c.moveTo(gx + Math.cos(a) * 46, 770 + Math.sin(a) * 46);
          c.lineTo(gx + Math.cos(a) * 54, 770 + Math.sin(a) * 54);
          c.stroke();
        }
      }
      // glovebox
      c.strokeStyle = 'rgba(0,0,0,0.5)';
      c.lineWidth = 3;
      c.beginPath();
      c.roundRect(1080, 730, 300, 120, 14);
      c.stroke();
      c.fillStyle = '#9aa0a8';
      c.fillRect(1210, 744, 40, 10);
      // name plates
      c.font = '700 18px Fredoka, sans-serif';
      c.textAlign = 'center';
      for (const [i, sec] of this.sections.entries()) {
        const cx = this.sectionX(i);
        const y = dashTop(cx) + 32;
        c.fillStyle = alpha(sec.color, 0.9);
        const label = this.sections.length > 1 ? `${sec.name}’s dash` : 'Your dash';
        const tw = c.measureText(label).width + 22;
        c.beginPath();
        c.roundRect(cx - tw / 2, y - 18, tw, 26, 13);
        c.fill();
        c.fillStyle = INK;
        c.fillText(label, cx, y);
      }
    });
  }

  sectionX(i: number): number {
    const n = this.sections.length;
    if (n <= 1) return 800;
    return 230 + (i * (1370 - 230)) / (n - 1);
  }

  draw(c: CanvasRenderingContext2D, dt: number, now: number): void {
    this.t += dt;
    if (!this.bg) this.buildBg();
    if (!this.dash || this.dashFor !== this.sections.map((s) => s.name).join('|')) this.buildDash();
    const speed = this.t < 0.8 ? this.t / 0.8 : this.t > this.dur - 1 ? Math.max(0.15, this.dur - this.t) : 1;
    // bumps
    this.nextBump -= dt;
    if (this.nextBump <= 0) {
      this.nextBump = 0.7 + Math.random() * 1.2;
      const s = 0.6 + Math.random() * 0.9;
      this.shakeY = 6 * s;
      for (const row of this.wobs) for (const w of row) bump(w, s * speed);
    }
    this.shakeY *= Math.pow(0.02, dt);
    const pr = pixelRatio();
    // whole device pixels only: a fractional offset makes every big image get resampled
    const sy = Math.round(Math.sin(now * 40) * this.shakeY * pr) / pr;
    const half = Math.round(sy * 0.5 * pr) / pr;
    c.save();
    c.translate(0, half);
    c.drawImage(this.bg!, 0, 0, this.bg!.width / pr, this.bg!.height / pr);
    // road stripes
    this.dashScroll = (this.dashScroll + dt * speed * 2.2) % 1;
    c.fillStyle = '#f0d060';
    for (let i = 0; i < 9; i++) {
      const z = (i + 1 - this.dashScroll) * 3.2;
      const s0 = 1 / (1 + z * 0.35);
      const s1 = 1 / (1 + (z + 1.3) * 0.35);
      const y0 = VP.y + (ROAD_Y + 40 - VP.y) * s0;
      const y1 = VP.y + (ROAD_Y + 40 - VP.y) * s1;
      c.beginPath();
      c.moveTo(VP.x - 7 * s0, y0);
      c.lineTo(VP.x + 7 * s0, y0);
      c.lineTo(VP.x + 7 * s1, y1);
      c.lineTo(VP.x - 7 * s1, y1);
      c.fill();
    }
    // roadside things
    const { ground } = this.palette();
    this.things.sort((a, b) => b.z - a.z);
    for (const th of this.things) {
      th.z -= dt * speed * 7;
      if (th.z < 0.05) Object.assign(th, this.newThing(28 + Math.random() * 4));
      const s = 1 / (1 + th.z * 0.35);
      const y = VP.y + (ROAD_Y + 40 - VP.y) * s;
      // just off the road's edge (which widens toward us), then further out
      const edge = 8 + (W * 0.45 - 8) * s;
      const x = VP.x + th.side * (edge + (30 + th.off) * s);
      this.thing(c, th.kind, x, y, s * 2.4, ground);
    }
    // the mission sign
    if (this.to) {
      this.signZ -= dt * speed * 7 * 0.55;
      if (this.signZ > 0.6) this.sign(c);
    }
    c.restore();
    // the cab: roof strip, pillars, dash
    c.save();
    c.translate(0, sy);
    c.drawImage(this.top!, 0, 0, W, TOP_H);
    c.fillStyle = FRAME;
    c.fillRect(0, TOP_H - 1, 70, 642 - TOP_H);
    c.fillRect(W - 70, TOP_H - 1, 70, 642 - TOP_H);
    c.drawImage(this.dash!, 0, DASH_Y, W, H - DASH_Y);
    // gauge needles
    for (const [gx, v] of [
      [250, 0.55 * speed + Math.sin(now * 7) * 0.02],
      [400, 0.4 + Math.sin(now * 0.3) * 0.05],
    ] as const) {
      const a = Math.PI * 0.8 + v * Math.PI * 1.4;
      c.strokeStyle = '#ff5a3a';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(gx, 770);
      c.lineTo(gx + Math.cos(a) * 44, 770 + Math.sin(a) * 44);
      c.stroke();
    }
    // the radio's scrolling text: drawn once into a strip, then only the window that shows is copied each frame
    c.save();
    if (!this.radioStrip) {
      const text = `📻 KEEP 101.5 ·  ${this.radio}  ·  `;
      const m = document.createElement('canvas').getContext('2d')!;
      m.font = '700 22px "Courier New", monospace';
      const tw = Math.ceil(m.measureText(text).width);
      this.radioStrip = layer(tw * 2, 36, (x) => {
        x.font = '700 22px "Courier New", monospace';
        x.fillStyle = '#7cff9a';
        x.textAlign = 'left';
        x.fillText(text, 0, 26);
        x.fillText(text, tw, 26);
      });
      this.radioW = tw;
    }
    const off = (now * 90) % this.radioW;
    const sw = this.radioStrip.width / (this.radioW * 2);
    c.drawImage(this.radioStrip, off * sw, 0, 292 * sw, this.radioStrip.height, W / 2 - 146, 758, 292, 36);
    c.restore();
    // ornaments
    this.hits = [];
    for (const [si, sec] of this.sections.entries()) {
      const cx = this.sectionX(si);
      sec.ornaments.forEach((o, oi) => {
        const w = this.wobs[si]![oi]!;
        stepWob(w, dt, o?.type ?? 'bobble');
        const x = cx + (oi - 1) * 104;
        const y = dashTop(x) + 4;
        if (!o) {
          c.strokeStyle = 'rgba(255,255,255,0.18)';
          c.lineWidth = 2;
          c.setLineDash([5, 5]);
          c.beginPath();
          c.ellipse(x, y, 30, 9, 0, 0, Math.PI * 2);
          c.stroke();
          c.setLineDash([]);
          return;
        }
        c.save();
        c.translate(x, y);
        drawOrnament(c, o, w, now);
        c.restore();
        this.hits.push({ x: x - 40, y: y - 110, w: 80, h: 120, si, oi });
      });
    }
    // steering wheel
    c.strokeStyle = '#14161a';
    c.lineWidth = 34;
    c.beginPath();
    c.arc(330, 1010, 230, Math.PI * 1.1, Math.PI * 1.9);
    c.stroke();
    c.strokeStyle = '#2a2e36';
    c.lineWidth = 6;
    c.stroke();
    c.restore();
    // arriving: a soft fade to white
    if (this.t > this.dur - 0.6) {
      c.fillStyle = `rgba(255,248,236,${Math.min(1, (this.t - (this.dur - 0.6)) / 0.6)})`;
      c.fillRect(0, 0, W, H);
    }
  }

  private thing(c: CanvasRenderingContext2D, kind: Thing['kind'], x: number, y: number, s: number, ground: string): void {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.strokeStyle = INK;
    c.lineWidth = 2;
    const snow = this.to?.biome === 'ice';
    if (kind === 'tree') {
      c.fillStyle = '#6a4a2a';
      c.fillRect(-3, -14, 6, 14);
      c.fillStyle = snow ? '#3a5a4a' : this.to?.biome === 'swamp' ? '#4a5a2a' : '#2e6a3a';
      c.beginPath();
      c.moveTo(-16, -12);
      c.lineTo(0, -62);
      c.lineTo(16, -12);
      c.closePath();
      c.fill();
      c.stroke();
      if (snow) {
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.moveTo(-6, -44);
        c.lineTo(0, -62);
        c.lineTo(6, -44);
        c.fill();
      }
    } else if (kind === 'pole') {
      c.fillStyle = '#7a5a3a';
      c.fillRect(-2.5, -80, 5, 80);
      c.fillRect(-14, -74, 28, 4);
    } else if (kind === 'bush') {
      c.fillStyle = shade(ground, -0.25);
      c.beginPath();
      c.ellipse(0, -8, 16, 10, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    } else if (kind === 'rock') {
      c.fillStyle = '#8a8a84';
      c.beginPath();
      c.ellipse(0, -6, 14, 8, 0, Math.PI, 0);
      c.fill();
      c.stroke();
    } else {
      c.strokeStyle = '#5a7a3a';
      c.lineWidth = 2.5;
      for (let i = -2; i <= 2; i++) {
        c.beginPath();
        c.moveTo(i * 3, 0);
        c.lineTo(i * 4, -30);
        c.stroke();
      }
    }
    c.restore();
  }

  private sign(c: CanvasRenderingContext2D): void {
    const h = this.to!;
    const s = 1 / (1 + this.signZ * 0.35);
    const y = VP.y + (ROAD_Y + 40 - VP.y) * s;
    const x = VP.x + 8 + (W * 0.45 - 8) * s + 90 * s;
    const k = s * 3.1;
    c.save();
    c.translate(x, y);
    c.scale(k, k);
    c.fillStyle = '#5a4a3a';
    c.fillRect(-48, -60, 6, 60);
    c.fillRect(42, -60, 6, 60);
    c.fillStyle = '#2a6a4a';
    c.strokeStyle = '#f4f0e0';
    c.lineWidth = 2.5;
    c.beginPath();
    c.roundRect(-74, -118, 148, 66, 6);
    c.fill();
    c.stroke();
    c.fillStyle = '#f4f0e0';
    c.textAlign = 'center';
    c.font = '700 13px Fredoka, sans-serif';
    c.fillText(h.name.toUpperCase(), 0, -100);
    c.font = '900 17px "Lilita One", sans-serif';
    c.fillStyle = '#ffd23a';
    c.fillText(h.mission.title.toUpperCase(), 0, -80);
    c.font = '600 9px Fredoka, sans-serif';
    c.fillStyle = '#f4f0e0';
    c.fillText(h.mission.text.length > 34 ? h.mission.text.slice(0, 33) + '…' : h.mission.text, 0, -62);
    c.restore();
  }
}
