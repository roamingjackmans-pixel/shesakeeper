// Every fish drawn in code: chunky outline, two-tone body, fins, a pattern and a big eye. Facing right, centred on
// (0,0), `len` pixels nose to tail. Junk has its own little drawings. Cached as images for the menus.
import { FISH, type FishArt, type Species } from '../data/fish';

export const INK = '#1b1a2e';

function bodyPath(c: CanvasRenderingContext2D, L: number, H: number, a: FishArt): void {
  const nose = L / 2;
  const tail = -L / 2 + L * 0.16;
  c.beginPath();
  switch (a.shape) {
    case 'eel':
      c.moveTo(nose, 0);
      c.bezierCurveTo(nose - L * 0.1, -H * 0.55, tail + L * 0.2, -H * 0.5, tail - L * 0.12, -H * 0.18);
      c.lineTo(tail - L * 0.12, H * 0.18);
      c.bezierCurveTo(tail + L * 0.2, H * 0.5, nose - L * 0.1, H * 0.55, nose, 0);
      break;
    case 'flat':
      c.ellipse(L * 0.04, 0, L * 0.4, H * 0.5, 0, 0, Math.PI * 2);
      break;
    case 'puffer':
      c.ellipse(L * 0.06, 0, L * 0.36, H * 0.5, 0, 0, Math.PI * 2);
      break;
    case 'gar':
    case 'sturgeon':
      c.moveTo(nose, 0);
      c.bezierCurveTo(nose - L * 0.12, -H * 0.25, nose - L * 0.3, -H * 0.5, 0, -H * 0.5);
      c.bezierCurveTo(-L * 0.25, -H * 0.5, tail + L * 0.05, -H * 0.3, tail, -H * 0.15);
      c.lineTo(tail, H * 0.15);
      c.bezierCurveTo(tail + L * 0.05, H * 0.3, -L * 0.25, H * 0.5, 0, H * 0.5);
      c.bezierCurveTo(nose - L * 0.3, H * 0.5, nose - L * 0.12, H * 0.25, nose, 0);
      break;
    default: {
      // torpedo / deep / cat / tuna / tiny / legend
      const blunt = a.shape === 'cat' ? 0.3 : a.shape === 'deep' ? 0.22 : 0.12;
      c.moveTo(nose, H * 0.05);
      c.bezierCurveTo(nose, -H * blunt, nose - L * 0.18, -H * 0.5, nose - L * 0.38, -H * 0.5);
      c.bezierCurveTo(-L * 0.1, -H * 0.5, tail + L * 0.06, -H * 0.24, tail, -H * 0.12);
      c.lineTo(tail, H * 0.12);
      c.bezierCurveTo(tail + L * 0.06, H * 0.24, -L * 0.1, H * 0.5, nose - L * 0.38, H * 0.5);
      c.bezierCurveTo(nose - L * 0.18, H * 0.5, nose, H * blunt, nose, H * 0.05);
    }
  }
  c.closePath();
}

function tailPath(c: CanvasRenderingContext2D, L: number, H: number, a: FishArt, wag: number): void {
  const base = -L / 2 + L * 0.16;
  const tl = L * (a.shape === 'eel' ? 0.12 : 0.2);
  const th = H * (a.shape === 'tuna' || a.tail === 'moon' ? 0.9 : a.shape === 'eel' ? 0.35 : 0.65);
  const tip = base - tl;
  const w = wag * H * 0.25;
  c.beginPath();
  c.moveTo(base + L * 0.02, -H * 0.1);
  switch (a.tail ?? 'fork') {
    case 'round':
      c.quadraticCurveTo(tip - tl * 0.3, -th * 0.6 + w, tip, w);
      c.quadraticCurveTo(tip - tl * 0.3, th * 0.6 + w, base + L * 0.02, H * 0.1);
      break;
    case 'square':
      c.lineTo(tip, -th * 0.5 + w);
      c.lineTo(tip + tl * 0.1, w);
      c.lineTo(tip, th * 0.5 + w);
      c.lineTo(base + L * 0.02, H * 0.1);
      break;
    case 'moon':
      c.quadraticCurveTo(tip + tl * 0.2, -th * 0.3 + w, tip - tl * 0.2, -th * 0.55 + w);
      c.quadraticCurveTo(tip + tl * 0.45, w, tip - tl * 0.2, th * 0.55 + w);
      c.quadraticCurveTo(tip + tl * 0.2, th * 0.3 + w, base + L * 0.02, H * 0.1);
      break;
    default:
      c.lineTo(tip, -th * 0.5 + w);
      c.lineTo(tip + tl * 0.45, w);
      c.lineTo(tip, th * 0.5 + w);
      c.lineTo(base + L * 0.02, H * 0.1);
  }
  c.closePath();
}

function junk(c: CanvasRenderingContext2D, L: number, a: FishArt): void {
  c.lineJoin = 'round';
  c.lineWidth = Math.max(2, L * 0.045);
  c.strokeStyle = INK;
  if (a.shape === 'boot') {
    c.fillStyle = a.body;
    c.beginPath();
    c.moveTo(-L * 0.3, -L * 0.45);
    c.lineTo(L * 0.02, -L * 0.45);
    c.lineTo(L * 0.05, -L * 0.05);
    c.quadraticCurveTo(L * 0.45, -L * 0.02, L * 0.48, L * 0.18);
    c.lineTo(L * 0.48, L * 0.28);
    c.lineTo(-L * 0.32, L * 0.28);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = a.fin;
    c.fillRect(-L * 0.34, L * 0.2, L * 0.84, L * 0.1);
    c.strokeRect(-L * 0.34, L * 0.2, L * 0.84, L * 0.1);
    c.strokeStyle = '#d8c8a0';
    c.lineWidth = Math.max(1, L * 0.02);
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.moveTo(-L * 0.2, -L * 0.35 + i * L * 0.08);
      c.lineTo(-L * 0.02, -L * 0.33 + i * L * 0.08);
      c.stroke();
    }
  } else if (a.shape === 'can') {
    c.fillStyle = a.body;
    c.beginPath();
    c.roundRect(-L * 0.25, -L * 0.38, L * 0.5, L * 0.76, L * 0.06);
    c.fill();
    c.stroke();
    c.fillStyle = a.belly;
    c.fillRect(-L * 0.25, -L * 0.15, L * 0.5, L * 0.3);
    c.strokeRect(-L * 0.25, -L * 0.15, L * 0.5, L * 0.3);
    c.fillStyle = '#8a5a2a';
    c.beginPath();
    c.arc(L * 0.1, L * 0.25, L * 0.06, 0, Math.PI * 2);
    c.fill();
  } else if (a.shape === 'duck') {
    c.fillStyle = a.body;
    c.beginPath();
    c.ellipse(-L * 0.05, L * 0.12, L * 0.42, L * 0.26, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.beginPath();
    c.arc(L * 0.18, -L * 0.22, L * 0.22, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = a.belly;
    c.beginPath();
    c.ellipse(L * 0.44, -L * 0.18, L * 0.14, L * 0.07, 0.1, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = INK;
    c.beginPath();
    c.arc(L * 0.24, -L * 0.28, L * 0.04, 0, Math.PI * 2);
    c.fill();
  } else {
    // bottle with a note
    c.fillStyle = a.body;
    c.globalAlpha = 0.9;
    c.beginPath();
    c.roundRect(-L * 0.42, -L * 0.16, L * 0.66, L * 0.32, L * 0.1);
    c.rect(L * 0.22, -L * 0.07, L * 0.2, L * 0.14);
    c.fill();
    c.globalAlpha = 1;
    c.stroke();
    c.fillStyle = '#a8784a';
    c.fillRect(L * 0.38, -L * 0.08, L * 0.08, L * 0.16);
    c.fillStyle = a.belly;
    c.save();
    c.rotate(-0.15);
    c.fillRect(-L * 0.28, -L * 0.08, L * 0.4, L * 0.16);
    c.restore();
  }
}

export interface FishOpts {
  wag?: number;
  /** 0..1 shine on top (golden glints) */
  glow?: boolean;
}

/** draw a species facing right, centred at the origin of the current transform */
export function drawFish(c: CanvasRenderingContext2D, sp: Species, len: number, o: FishOpts = {}): void {
  const a = sp.art;
  if (['boot', 'can', 'duck', 'bottle'].includes(a.shape)) return junk(c, len, a);
  const L = len;
  const H = L * (a.h ?? (a.shape === 'deep' ? 0.45 : a.shape === 'tiny' ? 0.26 : 0.3));
  const lw = Math.max(1.5, L * 0.035);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.strokeStyle = INK;
  c.lineWidth = lw;
  const wag = o.wag ?? 0;
  // dorsal and belly fins
  c.fillStyle = a.fin;
  c.beginPath();
  if (a.shape === 'legend') {
    // a crown of a dorsal fin
    c.moveTo(L * 0.15, -H * 0.45);
    for (let i = 0; i <= 5; i++) {
      const x = L * 0.15 - i * L * 0.08;
      c.lineTo(x - L * 0.02, -H * (0.95 + (i % 2) * 0.18));
      c.lineTo(x - L * 0.06, -H * 0.5);
    }
  } else if (a.shape === 'eel' || a.shape === 'gar' || a.shape === 'sturgeon') {
    c.moveTo(-L * 0.05, -H * 0.42);
    c.quadraticCurveTo(-L * 0.2, -H * 0.8, -L * 0.32, -H * 0.25);
  } else if (a.shape === 'flat') {
    c.ellipse(L * 0.04, 0, L * 0.46, H * 0.6, 0, 0, Math.PI * 2);
  } else {
    c.moveTo(L * 0.12, -H * 0.45);
    c.quadraticCurveTo(-L * 0.02, -H * (a.shape === 'deep' ? 0.85 : 0.95), -L * 0.22, -H * 0.38);
  }
  c.closePath();
  c.fill();
  c.stroke();
  if (a.shape !== 'flat') {
    c.beginPath();
    c.moveTo(-L * 0.02, H * 0.42);
    c.quadraticCurveTo(-L * 0.1, H * 0.75, -L * 0.2, H * 0.36);
    c.closePath();
    c.fill();
    c.stroke();
  }
  // tail
  tailPath(c, L, H, a, wag);
  c.fill();
  c.stroke();
  // body: belly colour, back colour on top (clipped)
  bodyPath(c, L, H, a);
  c.fillStyle = a.belly;
  c.fill();
  c.save();
  c.clip();
  c.fillStyle = a.body;
  c.beginPath();
  c.ellipse(0, -H * 0.42, L * 0.62, H * 0.62, 0, 0, Math.PI * 2);
  c.fill();
  // pattern
  const p = a.pattern ?? 'none';
  c.fillStyle = a.pat ?? INK;
  c.strokeStyle = a.pat ?? INK;
  const rnd = mulberry(hashStr(sp.id));
  if (p === 'spots' || p === 'speckle') {
    const n = p === 'spots' ? 14 : 26;
    const r = p === 'spots' ? H * 0.07 : H * 0.04;
    for (let i = 0; i < n; i++) {
      c.beginPath();
      c.arc(-L * 0.35 + rnd() * L * 0.72, -H * 0.4 + rnd() * H * 0.7, r * (0.6 + rnd() * 0.6), 0, Math.PI * 2);
      c.fill();
    }
  } else if (p === 'bars') {
    c.globalAlpha = 0.55;
    for (let i = 0; i < 6; i++) {
      const x = -L * 0.28 + i * L * 0.11;
      c.fillRect(x, -H * 0.5, L * 0.045, H * 0.75);
    }
    c.globalAlpha = 1;
  } else if (p === 'stripes') {
    c.lineWidth = H * 0.06;
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.moveTo(-L * 0.38, -H * 0.3 + i * H * 0.17);
      c.lineTo(L * 0.3, -H * 0.3 + i * H * 0.17);
      c.stroke();
    }
  } else if (p === 'lateral') {
    c.globalAlpha = 0.75;
    c.lineWidth = H * 0.12;
    c.beginPath();
    c.moveTo(-L * 0.4, 0);
    c.quadraticCurveTo(0, -H * 0.06, L * 0.32, -H * 0.04);
    c.stroke();
    c.globalAlpha = 1;
  } else if (p === 'patches') {
    for (let i = 0; i < 7; i++) {
      c.beginPath();
      c.ellipse(-L * 0.32 + rnd() * L * 0.6, -H * 0.3 + rnd() * H * 0.55, L * (0.05 + rnd() * 0.06), H * (0.08 + rnd() * 0.1), rnd() * 3, 0, Math.PI * 2);
      c.fill();
    }
  } else if (p === 'chain') {
    c.lineWidth = Math.max(1, H * 0.035);
    for (let i = 0; i < 9; i++)
      for (let j = 0; j < 3; j++) {
        c.beginPath();
        c.ellipse(-L * 0.36 + i * L * 0.08, -H * 0.25 + j * H * 0.22, L * 0.035, H * 0.08, 0, 0, Math.PI * 2);
        c.stroke();
      }
  }
  // a soft shine along the back
  c.globalAlpha = o.glow ? 0.55 : 0.22;
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.ellipse(L * 0.06, -H * 0.3, L * 0.3, H * 0.08, -0.05, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;
  c.restore();
  c.strokeStyle = INK;
  c.lineWidth = lw;
  bodyPath(c, L, H, a);
  c.stroke();
  // gill line
  c.lineWidth = lw * 0.7;
  c.beginPath();
  const gx = a.shape === 'flat' ? L * 0.22 : a.shape === 'gar' || a.shape === 'sturgeon' ? L * 0.22 : L * 0.27;
  c.arc(gx - H * 0.3, 0, H * 0.32, -0.9, 0.9);
  c.stroke();
  // whiskers
  if (a.shape === 'cat' || a.shape === 'sturgeon') {
    c.lineWidth = lw * 0.6;
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(L * 0.46, H * 0.05);
      c.quadraticCurveTo(L * 0.56, H * 0.25 * s + H * 0.2, L * 0.5, H * 0.42 * s + H * 0.25);
      c.stroke();
    }
  }
  // eye
  const ex = a.shape === 'flat' ? L * 0.26 : a.shape === 'gar' ? L * 0.36 : L * 0.34;
  const ey = a.shape === 'flat' ? -H * 0.2 : -H * 0.1;
  const er = Math.max(2, H * (a.shape === 'tiny' ? 0.14 : 0.12));
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.arc(ex, ey, er, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = INK;
  c.beginPath();
  c.arc(ex + er * 0.25, ey, er * 0.55, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.arc(ex + er * 0.4, ey - er * 0.25, er * 0.18, 0, Math.PI * 2);
  c.fill();
  if (a.shape === 'legend') {
    // lashes
    c.lineWidth = lw * 0.6;
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.moveTo(ex - er * 0.5 + i * er * 0.5, ey - er * 0.9);
      c.lineTo(ex - er * 0.7 + i * er * 0.6, ey - er * 1.6);
      c.stroke();
    }
  }
  // mouth
  c.lineWidth = lw * 0.7;
  c.beginPath();
  c.moveTo(L * 0.49, H * 0.08);
  c.quadraticCurveTo(L * 0.44, H * 0.14, L * 0.4, H * 0.1);
  c.stroke();
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const imgCache = new Map<string, string>();

/**
 * A data-URL picture of a fish for menus and cards. Drawn once per fish (and once more as a silhouette) at one size,
 * 2:1, sharp up to 300×150 on screen; the page scales it with CSS. `_w`/`_h` are only the size it will be shown at.
 */
export function fishImage(id: string, _w = 160, _h = 80, silhouette = false): string {
  const key = `${id}:${silhouette}`;
  const hit = imgCache.get(key);
  if (hit) return hit;
  const sp = FISH[id];
  const c = document.createElement('canvas');
  const w = 300;
  const h = 150;
  const s = 1.5;
  c.width = w * s;
  c.height = h * s;
  const x = c.getContext('2d')!;
  x.scale(s, s);
  x.translate(w / 2, h / 2);
  if (sp) {
    const junkish = ['boot', 'can', 'duck', 'bottle'].includes(sp.art.shape);
    const len = junkish ? Math.min(w, h) * 0.95 : Math.min(w * 0.8, h * 2.2);
    drawFish(x, sp, len, { glow: sp.id === 'marlene' });
    if (silhouette) {
      x.globalCompositeOperation = 'source-atop';
      x.fillStyle = '#2a3a4a';
      x.fillRect(-w, -h, w * 2, h * 2);
    }
  }
  const url = c.toDataURL();
  imgCache.set(key, url);
  return url;
}
