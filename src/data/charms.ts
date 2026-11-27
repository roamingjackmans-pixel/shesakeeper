// Run charms (Balatro-joker-like, bought in a run's shop, gone when the run ends; three slots at each hole) and the
// daily modifiers (the day's twists for everyone; a co-op host can also pick them as house rules).
import type { StatBonus } from '../core/stats';

/** what scoring knows about one catch, for the charms that look at it */
export interface CatchView {
  cm: number;
  /** 0..1+ through the species' size range */
  sizeFrac: number;
  perfect: boolean;
  bubble: boolean;
  junk: boolean;
  rare: boolean;
  mission: boolean;
  reelTime: number;
  /** seconds into the hole, and the hole's length */
  t: number;
  holeLen: number;
  /** different species caught earlier in this hole */
  speciesBefore: number;
  newSpecies: boolean;
}

export interface CharmDef {
  id: string;
  name: string;
  price: number;
  text: string;
  glyph: string;
  color: string;
  bonus?: StatBonus;
  /** extra multiplier on a catch (+0.5 = +50%), added to the others */
  mult?: (c: CatchView) => number;
  /** points added to every catch before multipliers */
  flat?: number;
  /** cash interest at each shop: share of your cash, up to a cap */
  interest?: [number, number];
}

export const CHARMS: CharmDef[] = [
  { id: 'penny', name: 'Lucky Penny', price: 150, text: 'Every catch +20 points.', glyph: '¢', color: '#d8803a', flat: 20 },
  { id: 'streak', name: 'Hot Streak', price: 250, text: 'Doubles the streak bonus (+4% more per fish in a row).', glyph: '🔥', color: '#e8502c', bonus: { streak: 0.04 } },
  { id: 'story', name: 'Fish Story', price: 300, text: 'Fish in the top quarter of their size ×1.75.', glyph: '↔', color: '#3a7ad0', mult: (c) => (c.sizeFrac >= 0.75 ? 0.75 : 0) },
  { id: 'small', name: 'Small Wonders', price: 250, text: 'Fish under 15 cm ×2.5.', glyph: '•', color: '#6ac0a0', mult: (c) => (c.cm < 15 && !c.junk ? 1.5 : 0) },
  { id: 'early', name: 'Early Bird', price: 200, text: 'First 60 seconds of a hole ×1.6.', glyph: '☼', color: '#f0b030', mult: (c) => (c.t < 60 ? 0.6 : 0) },
  { id: 'last', name: 'Last Call', price: 220, text: 'Last 45 seconds of a hole ×2.', glyph: '⌛', color: '#8a4ad0', mult: (c) => (c.t >= c.holeLen - 45 ? 1 : 0) },
  { id: 'wand', name: 'Bubble Wand', price: 260, text: 'Fish from bubbles ×1.75, bubble power +25%.', glyph: '○', color: '#4ac0e8', bonus: { bubbleBoost: 0.25 }, mult: (c) => (c.bubble ? 0.75 : 0) },
  { id: 'collector', name: 'Collector’s Badge', price: 300, text: 'Each different species earlier this hole: +20% on every fish.', glyph: '★', color: '#c8a030', mult: (c) => 0.2 * c.speciesBefore },
  { id: 'pin', name: 'Perfectionist’s Pin', price: 280, text: 'Perfect catches ×2.', glyph: '◆', color: '#e84a8a', mult: (c) => (c.perfect ? 1 : 0) },
  { id: 'coupon', name: 'Coupon Book', price: 180, text: 'Shop prices 25% lower.', glyph: '%', color: '#4aa05a', bonus: { shopDiscount: 0.25 } },
  { id: 'piggy', name: 'Piggy Bank', price: 200, text: 'At each shop, +15% interest on your cash (up to $300).', glyph: '🐷', color: '#f08aa0', interest: [0.15, 300] },
  { id: 'trick', name: 'Tackle Trick', price: 220, text: 'Catch bar +20%.', glyph: '▮', color: '#5aa040', bonus: { barSize: 0.2 } },
  { id: 'eye', name: 'Sharp Eye', price: 160, text: '+60% time to hook, 15% hook save.', glyph: '👁', color: '#3a8a8a', bonus: { hookWindow: 0.6, hookSave: 0.15 } },
  { id: 'magnet', name: 'Monster Magnet', price: 320, text: 'Rare fish +80% more likely.', glyph: '⚡', color: '#a03ac8', bonus: { rareChance: 0.8 } },
  { id: 'fortune', name: 'Fisher’s Fortune', price: 240, text: '+25% treasure chance.', glyph: '⛃', color: '#e8b030', bonus: { treasureChance: 0.25 } },
  { id: 'weather', name: 'Weatherman', price: 260, text: '+50% points in rain, fog, snow or storm.', glyph: '☂', color: '#5a7ab0', bonus: { pWeather: 0.5 } },
  { id: 'nightlight', name: 'Night Light', price: 260, text: '+50% points at dusk and night.', glyph: '☾', color: '#3a3a8a', bonus: { pNight: 0.5 } },
  { id: 'double', name: 'Double Down', price: 350, text: 'Mission multiplier +×1.', glyph: '×', color: '#e84a4a', bonus: { missionMult: 1 } },
  { id: 'glass', name: 'Glass Hook', price: 300, text: 'Every fish ×1.6, but fish escape 40% faster.', glyph: '◇', color: '#8ad0e8', bonus: { escapeSlow: -0.4 }, mult: () => 0.6 },
  { id: 'reeler', name: 'Speed Reeler', price: 240, text: 'Reel 30% faster.', glyph: '⟳', color: '#e86a2a', bonus: { reelSpeed: 0.3 } },
  { id: 'wrist', name: 'Cast Iron Wrist', price: 180, text: 'Cast meter 35% slower, perfect window +50%.', glyph: '✋', color: '#6a6a72', bonus: { castControl: 0.35, perfectWindow: 0.5 } },
  { id: 'photo', name: 'Family Photo', price: 280, text: 'Mission fish ×1.5 more.', glyph: '▣', color: '#c87a4a', mult: (c) => (c.mission ? 0.5 : 0) },
  { id: 'junk', name: 'Junk Dealer', price: 120, text: 'Junk ×12. One person’s trash…', glyph: '♻', color: '#7a8a5a', mult: (c) => (c.junk ? 11 : 0), bonus: { attract: { junk: 0.4 } } },
  { id: 'ripple', name: 'Ripple Reader', price: 300, text: 'She shows up 20% more often.', glyph: '≈', color: '#f5c542', bonus: { legend: 0.2 } },
  { id: 'hands', name: 'Heavy Hands', price: 260, text: 'Fish 12% bigger.', glyph: '✊', color: '#8a5a3a', bonus: { fishSize: 0.12 } },
  { id: 'quick', name: 'Quick Draw', price: 260, text: 'Fish reeled in under 6 seconds ×2.', glyph: '⏱', color: '#e8c030', mult: (c) => (c.reelTime < 6 ? 1 : 0) },
  { id: 'bucket', name: 'Bait Bucket', price: 200, text: 'Bites come 30% faster.', glyph: '🪣', color: '#5a8a6a', bonus: { biteSpeed: 0.3 } },
  { id: 'bully', name: 'Bully', price: 260, text: 'With friends: shoves hit 50% harder and recharge 30% faster.', glyph: '💪', color: '#c8503a', bonus: { shove: 0.5, shoveCd: 0.3 } },
  { id: 'thick', name: 'Thick Skin', price: 200, text: 'With friends: shoves rock you 60% less.', glyph: '🛡', color: '#5a7a5a', bonus: { steady: 0.6 } },
  { id: 'compass', name: 'Pocket Compass', price: 220, text: 'Casts go 25% farther; long casts +40% points.', glyph: '➚', color: '#3a6a9a', bonus: { castDist: 0.25, pLongCast: 0.4 } },
];
export const CHARM: Record<string, CharmDef> = Object.fromEntries(CHARMS.map((c) => [c.id, c]));
export const CHARM_SLOTS = 3;

// ------------------------------------------------------------------ daily modifiers / house rules

export interface ModFlags {
  /** every hole at this time / in this weather */
  time?: 'night';
  weather?: 'storm';
  holeSeconds?: number;
  /** added to every fish's difficulty */
  diffAdd?: number;
  sizeMul?: number;
  bubbleRateMul?: number;
  bubbleCap?: number;
  /** hold to sink, let go to float */
  reverse?: boolean;
  wind?: boolean;
  /** an escaped fish snaps the line: this many seconds re-tying */
  snap?: number;
  missionDouble?: boolean;
  /** lightning makes the next seconds count double */
  charged?: boolean;
  legendAlways?: boolean;
}

export interface ModDef {
  id: string;
  name: string;
  text: string;
  glyph: string;
  bonus?: StatBonus;
  flags?: ModFlags;
  /** two mods that can't be on the same day */
  excludes?: string[];
}

export const MODS: ModDef[] = [
  { id: 'tiny', name: 'Tiny Tuesday', text: 'Every fish is half size, but small fish score ×3.', glyph: '🔍', flags: { sizeMul: 0.5 }, bonus: { pSmall: 2 }, excludes: ['heavy'] },
  { id: 'bath', name: 'Bubble Bath', text: 'Bubbles everywhere, but each holds one fish.', glyph: '🫧', flags: { bubbleRateMul: 3, bubbleCap: 1 } },
  { id: 'slippery', name: 'Butterfingers', text: 'Catch bar 35% smaller; every fish ×1.5.', glyph: '🧈', bonus: { barSize: -0.35, points: 0.5 } },
  { id: 'heavy', name: 'Heavy Hitters', text: 'Fish are 50% bigger and fight much harder.', glyph: '🏋', flags: { sizeMul: 1.5, diffAdd: 15 }, excludes: ['tiny'] },
  { id: 'ghost', name: 'Ghost Lake', text: 'Night at every hole. Rare fish 3× as likely.', glyph: '👻', flags: { time: 'night' }, bonus: { rareChance: 2 } },
  { id: 'trove', name: 'Treasure Trove', text: 'Every catch brings a treasure chest.', glyph: '💰', bonus: { treasureChance: 1 } },
  { id: 'reverse', name: 'Upside Down', text: 'Hold to sink the catch bar, let go to rise. Points ×1.3.', glyph: '🙃', flags: { reverse: true }, bonus: { points: 0.3 } },
  { id: 'speed', name: 'Speed Fishing', text: 'Holes last 2 minutes, but bites come 3× as fast.', glyph: '⚡', flags: { holeSeconds: 120 }, bonus: { biteSpeed: 2 } },
  { id: 'marlene', name: 'Marlene Watch', text: 'She shows up at every hole.', glyph: '👑', flags: { legendAlways: true } },
  { id: 'storm', name: 'Storm Chaser', text: 'Storms everywhere. After each lightning flash, 8 seconds of double points.', glyph: '⛈', flags: { weather: 'storm', charged: true }, excludes: ['ghost'] },
  { id: 'glassline', name: 'Glass Line', text: 'An escaped fish snaps your line: 8 seconds to re-tie. Points ×1.4.', glyph: '🧵', flags: { snap: 8 }, bonus: { points: 0.4 } },
  { id: 'junkyard', name: 'Junk Yard', text: 'Junk bites twice as often and scores ×20.', glyph: '🥾', bonus: { pJunk: 19, attract: { junk: 1 } } },
  { id: 'wind', name: 'Gusty', text: 'Wind blows your casts sideways. Watch the flag. Points ×1.25.', glyph: '🌬', flags: { wind: true }, bonus: { points: 0.25 } },
  { id: 'hot', name: 'Hot Potato', text: 'Fish dart 40% more; every fish ×1.4.', glyph: '🥔', bonus: { fishCalm: -0.4, points: 0.4 } },
  { id: 'allin', name: 'All In', text: 'Mission multipliers are doubled.', glyph: '🎯', flags: { missionDouble: true } },
  { id: 'lucky', name: 'Lucky Streak', text: 'Streak bonus ×3.', glyph: '🍀', bonus: { streak: 0.08 } },
];
export const MOD: Record<string, ModDef> = Object.fromEntries(MODS.map((m) => [m.id, m]));

export function modFlags(ids: string[]): ModFlags {
  const f: ModFlags = {};
  for (const id of ids) {
    const m = MOD[id];
    if (!m?.flags) continue;
    for (const [k, v] of Object.entries(m.flags)) {
      if (k === 'sizeMul' || k === 'bubbleRateMul') (f as Record<string, unknown>)[k] = ((f as Record<string, number>)[k] ?? 1) * (v as number);
      else if (k === 'diffAdd') f.diffAdd = (f.diffAdd ?? 0) + (v as number);
      else (f as Record<string, unknown>)[k] = v;
    }
  }
  return f;
}
