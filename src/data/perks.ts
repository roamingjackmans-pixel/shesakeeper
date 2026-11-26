// Dash ornament perks (good) and curses (bad). An ornament rolls 1–3 good perks, each with a random value in its
// range. A good perk can bring a curse along; a strong roll (or a potent perk) always does.
import type { StatKey, Tag } from '../core/stats';

/** a perk key is a stat, or "attract:<tag>" */
export type PerkKey = StatKey | `attract:${Tag}`;

export interface PerkDef {
  k: PerkKey;
  min: number;
  max: number;
  /** strong enough that it always comes with a curse */
  potent?: boolean;
  /** whole numbers only */
  int?: boolean;
  /** how often it rolls (default 1) */
  w?: number;
  /** the adjective it gives an ornament: "Steady Hula Dancer" */
  word: string;
  /** stats in the same family: a curse never touches them */
  group?: string;
}

const P = (k: PerkKey, min: number, max: number, word: string, extra: Partial<PerkDef> = {}): PerkDef => ({ k, min, max, word, ...extra });

export const GOOD_PERKS: PerkDef[] = [
  P('barSize', 0.05, 0.25, 'Steady', { w: 1.6, group: 'bar' }),
  P('reelSpeed', 0.05, 0.25, 'Speedy', { w: 1.3, group: 'reel' }),
  P('escapeSlow', 0.05, 0.25, 'Sticky', { w: 1.2, group: 'reel' }),
  P('fishCalm', 0.05, 0.25, 'Soothing', { group: 'bar' }),
  P('noBounce', 1, 1, 'Anchored', { w: 0.4, int: true, group: 'bar' }),
  P('castControl', 0.06, 0.3, 'Patient', { group: 'cast' }),
  P('castDist', 0.06, 0.3, 'Far-Flung', { group: 'cast' }),
  P('perfectWindow', 0.2, 1, 'Precise', { group: 'cast' }),
  P('hookWindow', 0.1, 0.5, 'Alert', { group: 'hook' }),
  P('hookSave', 0.05, 0.25, 'Barbed', { group: 'hook' }),
  P('biteSpeed', 0.06, 0.3, 'Tempting', { w: 1.3, group: 'bite' }),
  P('bubbleBoost', 0.1, 0.5, 'Fizzy', { group: 'bubble' }),
  P('bubbleRate', 0.1, 0.5, 'Bubbly', { group: 'bubble' }),
  P('treasureChance', 0.03, 0.15, 'Lucky', { group: 'treasure' }),
  P('treasureValue', 0.15, 0.6, 'Gilded', { group: 'treasure' }),
  P('fishSize', 0.04, 0.18, 'Mighty', { potent: true, group: 'size' }),
  P('rareChance', 0.1, 0.5, 'Uncanny', { group: 'rare' }),
  P('quality', 0.03, 0.12, 'Fine', { group: 'quality' }),
  P('doubleCatch', 0.03, 0.12, 'Twin', { potent: true, w: 0.7, group: 'double' }),
  P('legend', 0.02, 0.08, 'Fabled', { potent: true, w: 0.6, group: 'legend' }),
  P('points', 0.04, 0.15, 'Golden', { potent: true, w: 0.8, group: 'points' }),
  P('pSmall', 0.1, 0.6, 'Tiny'),
  P('pBig', 0.1, 0.5, 'Trophy'),
  P('pPanfish', 0.15, 0.6, 'Sunny'),
  P('pBass', 0.15, 0.6, 'Bassy'),
  P('pTrout', 0.15, 0.6, 'Speckled'),
  P('pCatfish', 0.15, 0.6, 'Whiskered'),
  P('pCarp', 0.15, 0.6, 'Muddy'),
  P('pPredator', 0.1, 0.5, 'Toothy'),
  P('pBottom', 0.1, 0.5, 'Deep'),
  P('pSalt', 0.15, 0.6, 'Salty'),
  P('pPrehistoric', 0.2, 0.8, 'Ancient'),
  P('pRare', 0.15, 0.6, 'Exotic'),
  P('pJunk', 1, 4, 'Junky', { w: 0.4 }),
  P('pNight', 0.1, 0.5, 'Moonlit'),
  P('pDay', 0.1, 0.5, 'Sunny'),
  P('pWeather', 0.1, 0.5, 'Stormy'),
  P('pPerfectCatch', 0.15, 0.6, 'Flawless'),
  P('pPerfectCast', 0.15, 0.6, 'Graceful'),
  P('pLongCast', 0.1, 0.5, 'Long-Arm'),
  P('pBubble', 0.1, 0.5, 'Frothy'),
  P('pFirstCatch', 0.3, 1.2, 'Early'),
  P('pTreasure', 0.2, 0.8, 'Shiny'),
  P('missionMult', 0.1, 0.5, 'Driven', { potent: true, w: 0.7, group: 'mission' }),
  P('streak', 0.01, 0.04, 'Hot', { group: 'streak' }),
  P('shopDiscount', 0.05, 0.2, 'Thrifty', { group: 'shop' }),
  P('rerollDiscount', 0.15, 0.5, 'Fickle', { group: 'shop' }),
  P('freeReroll', 1, 1, 'Shuffling', { int: true, potent: true, w: 0.4, group: 'shop' }),
  P('sellBonus', 0.15, 0.6, 'Haggling', { w: 0.7, group: 'shop' }),
  P('startCash', 50, 250, 'Rich', { int: true, group: 'shop' }),
  P('attract:catfish', 0.2, 0.6, 'Smelly', { w: 0.5 }),
  P('attract:trout', 0.2, 0.6, 'Feathered', { w: 0.5 }),
  P('attract:predator', 0.2, 0.6, 'Bloody', { w: 0.5 }),
  P('attract:salt', 0.2, 0.6, 'Briny', { w: 0.5 }),
  P('attract:panfish', 0.2, 0.6, 'Crumby', { w: 0.5 }),
];

export const CURSES: PerkDef[] = [
  P('barSize', -0.04, -0.15, '', { group: 'bar', w: 1.4 }),
  P('reelSpeed', -0.05, -0.18, '', { group: 'reel' }),
  P('escapeSlow', -0.05, -0.2, '', { group: 'reel' }),
  P('fishCalm', -0.05, -0.2, '', { group: 'bar' }),
  P('castControl', -0.06, -0.25, '', { group: 'cast' }),
  P('castDist', -0.05, -0.2, '', { group: 'cast' }),
  P('perfectWindow', -0.2, -0.5, '', { group: 'cast' }),
  P('hookWindow', -0.08, -0.25, '', { group: 'hook' }),
  P('biteSpeed', -0.05, -0.2, '', { group: 'bite' }),
  P('bubbleBoost', -0.1, -0.35, '', { group: 'bubble' }),
  P('treasureChance', -0.02, -0.06, '', { group: 'treasure' }),
  P('fishSize', -0.03, -0.12, '', { group: 'size' }),
  P('quality', -0.03, -0.08, '', { group: 'quality' }),
  P('pSmall', -0.15, -0.5, ''),
  P('pBig', -0.15, -0.4, ''),
  P('pNight', -0.15, -0.4, ''),
  P('pDay', -0.15, -0.4, ''),
  P('pWeather', -0.15, -0.4, ''),
  P('pBubble', -0.15, -0.4, ''),
  P('pPerfectCatch', -0.15, -0.4, ''),
  P('streak', -0.01, -0.03, '', { group: 'streak' }),
  P('shopDiscount', -0.05, -0.2, '', { group: 'shop' }),
  P('rerollDiscount', -0.2, -0.6, '', { group: 'shop' }),
  P('sellBonus', -0.2, -0.5, '', { group: 'shop', w: 0.6 }),
  P('points', -0.03, -0.08, '', { group: 'points', w: 0.5 }),
];

export const GOOD_BY_KEY: Record<string, PerkDef> = Object.fromEntries(GOOD_PERKS.map((p) => [p.k, p]));
export const CURSE_BY_KEY: Record<string, PerkDef> = Object.fromEntries(CURSES.map((p) => [p.k, p]));

// ------------------------------------------------------------------ what an ornament looks like

export type OrnType =
  | 'bobble'
  | 'hula'
  | 'dice'
  | 'pine'
  | 'bird'
  | 'cat'
  | 'duck'
  | 'flower'
  | 'compass'
  | 'bass'
  | 'lighthouse'
  | 'globe'
  | 'troll'
  | 'ball'
  | 'cactus'
  | 'turtle'
  | 'frog'
  | 'marlene';

/** how it moves when the truck bumps: a spring head, a swaying hip, a hanging pendulum, a bounce, or nothing */
export type Wobble = 'head' | 'sway' | 'hang' | 'bounce' | 'tip' | 'still';

export const ORN_TYPES: Record<OrnType, { name: string; wobble: Wobble; tints: string[] }> = {
  bobble: { name: 'Angler Bobblehead', wobble: 'head', tints: ['#e84a4a', '#3a7ad0', '#3aa06a', '#e8a030'] },
  hula: { name: 'Hula Dancer', wobble: 'sway', tints: ['#3aa06a', '#e85a8a', '#f0a030', '#6a4ad0'] },
  dice: { name: 'Fuzzy Dice', wobble: 'hang', tints: ['#e84a4a', '#f0f0f0', '#3a7ad0', '#f0c830'] },
  pine: { name: 'Pine Air Freshener', wobble: 'hang', tints: ['#2a8a4a', '#e84a8a', '#3a7ad0', '#e8a030'] },
  bird: { name: 'Drinking Bird', wobble: 'tip', tints: ['#e84a4a', '#3a7ad0', '#6ad0a0', '#f0a030'] },
  cat: { name: 'Lucky Cat', wobble: 'sway', tints: ['#f8f4ea', '#f0c830', '#2a2a2a', '#e8a0b0'] },
  duck: { name: 'Rubber Duck', wobble: 'bounce', tints: ['#f6d02c', '#e85a8a', '#6ad0f0', '#f8f8f8'] },
  flower: { name: 'Dancing Flower', wobble: 'sway', tints: ['#f0c830', '#e85a8a', '#6a4ad0', '#f07a2a'] },
  compass: { name: 'Dash Compass', wobble: 'tip', tints: ['#2a2a2a', '#8a5a2a', '#3a6a5a', '#5a3a6a'] },
  bass: { name: 'Bobble Bass', wobble: 'head', tints: ['#6b8f3c', '#5a8ab0', '#e05a4a', '#b8963c'] },
  lighthouse: { name: 'Tiny Lighthouse', wobble: 'bounce', tints: ['#e84a4a', '#3a7ad0', '#2a8a4a', '#2a2a2a'] },
  globe: { name: 'Snow Globe', wobble: 'still', tints: ['#6ad0f0', '#f0c0e0', '#a0f070', '#f0e0a0'] },
  troll: { name: 'Wild-Hair Doll', wobble: 'head', tints: ['#e84a8a', '#3ac0e0', '#a0e040', '#f07a2a'] },
  ball: { name: 'Fortune Ball', wobble: 'bounce', tints: ['#1a1a22', '#3a2a6a', '#6a1a2a', '#1a4a3a'] },
  cactus: { name: 'Potted Cactus', wobble: 'bounce', tints: ['#3a9a4a', '#5aaa6a', '#2a7a5a', '#7aaa3a'] },
  turtle: { name: 'Bobble Turtle', wobble: 'head', tints: ['#5a8a3a', '#3a7a6a', '#8a7a3a', '#6a9a8a'] },
  frog: { name: 'Spring Frog', wobble: 'bounce', tints: ['#5ab84a', '#3a9a6a', '#a0c83a', '#e8c040'] },
  marlene: { name: 'Marlene Bobblehead', wobble: 'head', tints: ['#f5c542'] },
};

export const COMMON_TYPES = (Object.keys(ORN_TYPES) as OrnType[]).filter((t) => t !== 'marlene');

export type Tier = 'plastic' | 'brass' | 'silver' | 'gold' | 'pearl';
export const TIERS: Record<Tier, { name: string; color: string; edge: string }> = {
  plastic: { name: 'Plastic', color: '#d8d0c0', edge: '#8a8070' },
  brass: { name: 'Brass', color: '#d8a04a', edge: '#7a5420' },
  silver: { name: 'Silver', color: '#d8e0ea', edge: '#6a7686' },
  gold: { name: 'Gold', color: '#f5c542', edge: '#9a6a10' },
  pearl: { name: 'Pearl', color: '#fff1e0', edge: '#e09a6a' },
};
