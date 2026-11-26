// Small colour helpers (hex in, css out) and the palette for each time of day.
import type { TimeOfDay, Weather } from '../data/fish';

export function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  const m = (i: number) => Math.round(x[i]! + (y[i]! - x[i]!) * t);
  return `#${((1 << 24) | (m(0) << 16) | (m(1) << 8) | m(2)).toString(16).slice(1)}`;
}

export function alpha(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function shade(hex: string, t: number): string {
  return t >= 0 ? mix(hex, '#ffffff', t) : mix(hex, '#000000', -t);
}

export interface SkyPal {
  top: string;
  mid: string;
  low: string;
  sun: string;
  /** what everything far away fades into */
  haze: string;
  /** overall light on the near scene: a colour to tint with, and how much */
  tint: string;
  tintA: number;
  /** 0 (day) .. 1 (night): stars, fireflies, glow */
  dark: number;
  sunX: number;
  sunY: number;
}

const BASE_SKY: Record<TimeOfDay, SkyPal> = {
  dawn: { top: '#56609e', mid: '#e89aa0', low: '#ffd6a0', sun: '#fff0c0', haze: '#f0b8b0', tint: '#ff9a8a', tintA: 0.12, dark: 0.2, sunX: 360, sunY: 255 },
  day: { top: '#3e98e0', mid: '#8ccaf0', low: '#dff3f6', sun: '#fffbe8', haze: '#c8e4f0', tint: '#ffffff', tintA: 0, dark: 0, sunX: 1180, sunY: 90 },
  dusk: { top: '#34336e', mid: '#c4567a', low: '#ff9e52', sun: '#ffd27a', haze: '#d8788a', tint: '#ff7a4a', tintA: 0.16, dark: 0.35, sunX: 1210, sunY: 262 },
  night: { top: '#070b22', mid: '#16224e', low: '#2a3a6e', sun: '#f4f2e0', haze: '#24305e', tint: '#1a2050', tintA: 0.38, dark: 1, sunX: 1260, sunY: 110 },
};

export function skyFor(time: TimeOfDay, weather: Weather): SkyPal {
  const s = { ...BASE_SKY[time] };
  const grey = weather === 'storm' ? '#3a404e' : weather === 'rain' ? '#7a8492' : weather === 'snow' ? '#b8c0cc' : weather === 'fog' ? '#c8ccd0' : weather === 'cloudy' ? '#9aa4b0' : '';
  if (grey) {
    const k = weather === 'cloudy' ? 0.35 : weather === 'fog' ? 0.55 : 0.6;
    const g = time === 'night' ? mix(grey, '#0a0e22', 0.75) : time === 'dusk' ? mix(grey, '#4a3050', 0.4) : grey;
    s.top = mix(s.top, g, k);
    s.mid = mix(s.mid, g, k);
    s.low = mix(s.low, g, k * 0.9);
    s.haze = mix(s.haze, g, k);
    if (weather === 'storm') {
      s.tint = '#20283a';
      s.tintA = Math.max(s.tintA, 0.3);
    }
  }
  return s;
}
