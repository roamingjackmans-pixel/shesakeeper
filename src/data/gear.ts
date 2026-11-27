// Rods, lures and bait: bought once in a run's shop and kept forever. At every fishing hole you pick one of each
// for the mission. There is no best set: every piece is good at something.
import type { StatBonus } from '../core/stats';

export type GearKind = 'rod' | 'lure' | 'bait';

export interface Gear {
  id: string;
  kind: GearKind;
  name: string;
  price: number;
  /** a one-line pitch */
  blurb: string;
  bonus: StatBonus;
  /** colours for the drawing */
  color: string;
  accent: string;
  /** not sold: earned another way */
  special?: string;
}

const R = (g: Omit<Gear, 'kind'>): Gear => ({ ...g, kind: 'rod' });
const L = (g: Omit<Gear, 'kind'>): Gear => ({ ...g, kind: 'lure' });
const B = (g: Omit<Gear, 'kind'>): Gear => ({ ...g, kind: 'bait' });

export const RODS: Gear[] = [
  R({ id: 'bamboo', name: 'Bamboo Pole', price: 0, blurb: 'Grandpa’s. It still works, mostly.', bonus: { castDist: -0.1 }, color: '#d8b86a', accent: '#8a6a2c' }),
  R({ id: 'fiberglass', name: 'Fiberglass Rod', price: 1500, blurb: 'Honest, bendy, dependable.', bonus: { barSize: 0.18, castDist: 0.1 }, color: '#e8e0c8', accent: '#3a7a9a' }),
  R({ id: 'ultralight', name: 'Ultralight Spinner', price: 2100, blurb: 'Tiny line, tiny fish, huge fun.', bonus: { barSize: 0.4, pSmall: 0.4, attract: { panfish: 0.4 }, fishSize: -0.1, castDist: -0.05 }, color: '#f0f0f0', accent: '#e05a7a' }),
  R({ id: 'bottom', name: 'Bottom Bouncer', price: 2500, blurb: 'Heavy tip, no bounce. Feels the mud.', bonus: { noBounce: 1, pBottom: 0.35, pCatfish: 0.25, attract: { bottom: 0.3 } }, color: '#5a4a3a', accent: '#c8a04a' }),
  R({ id: 'heavy', name: 'Heavy Boat Rod', price: 2900, blurb: 'For the fish that pull back.', bonus: { barSize: -0.12, reelSpeed: 0.28, escapeSlow: 0.15, fishSize: 0.15, pBig: 0.3, castDist: -0.1 }, color: '#2a2a2a', accent: '#e8c040' }),
  R({ id: 'surf', name: 'Surf Caster', price: 3900, blurb: 'Reaches the bubbles nobody else can.', bonus: { castDist: 0.5, pLongCast: 0.3, pSalt: 0.25, castControl: -0.12 }, color: '#e0e8f0', accent: '#2a6ad0' }),
  R({ id: 'fly', name: 'Fly Rod', price: 3300, blurb: 'Poetry. With a hook in it.', bonus: { perfectWindow: 0.7, pPerfectCast: 0.4, pTrout: 0.4, castControl: 0.18, barSize: 0.08, attract: { trout: 0.3 } }, color: '#b87a4a', accent: '#2a5a3a' }),
  R({ id: 'glow', name: 'Glow Rod', price: 3600, blurb: 'Lights up after sundown. So do the fish.', bonus: { pNight: 0.4, legend: 0.04, barSize: 0.15, hookWindow: 0.2 }, color: '#2a3a5a', accent: '#6af0d0' }),
  R({ id: 'carbon', name: 'Carbon Pro', price: 4400, blurb: 'Light, stiff, eye-wateringly expensive.', bonus: { barSize: 0.28, reelSpeed: 0.15, castDist: 0.18, hookWindow: 0.2 }, color: '#1a1a22', accent: '#e84a4a' }),
  R({ id: 'brawler', name: 'Brawler’s Pole', price: 3000, blurb: 'Built for elbows. With friends: shove harder, from further.', bonus: { shove: 0.6, shoveReach: 0.5, barSize: -0.06 }, color: '#8a3a2a', accent: '#f0c040' }),
  R({ id: 'golden', name: 'Golden Rod', price: 5200, blurb: 'Solid gold. Fish can’t resist a show-off.', bonus: { barSize: 0.32, reelSpeed: 0.2, quality: 0.12, points: 0.1, castDist: 0.2 }, color: '#f5c542', accent: '#fff1b0' }),
  R({ id: 'keeper', name: 'The Keeper’s Rod', price: 0, special: 'Land Marlene to earn it.', blurb: 'Carved from driftwood she left on the shore.', bonus: { barSize: 0.35, reelSpeed: 0.25, legend: 0.1, rareChance: 0.25, points: 0.15, castDist: 0.25 }, color: '#f5e6c8', accent: '#f5c542' }),
];

export const LURES: Gear[] = [
  L({ id: 'bobber', name: 'Red Bobber', price: 0, blurb: 'Red and white and full of hope.', bonus: {}, color: '#e84a4a', accent: '#f8f8f8' }),
  L({ id: 'spinner', name: 'Spinner', price: 900, blurb: 'Flashes, spins, gets noticed.', bonus: { biteSpeed: 0.22 }, color: '#d8d8e0', accent: '#e8b030' }),
  L({ id: 'popper', name: 'Popper', price: 950, blurb: 'Splashes on top. Little fish love drama.', bonus: { pSmall: 0.3, attract: { panfish: 0.35 } }, color: '#f8e04a', accent: '#2a8a4a' }),
  L({ id: 'cork', name: 'Cork Bobber', price: 1100, blurb: 'Floats high, gives you room.', bonus: { barSize: 0.25 }, color: '#c89a5a', accent: '#f0f0f0' }),
  L({ id: 'lead', name: 'Lead Bobber', price: 1100, blurb: 'Your catch bar stops bouncing.', bonus: { noBounce: 1, escapeSlow: 0.08 }, color: '#6a6a72', accent: '#b0b0b8' }),
  L({ id: 'jig', name: 'Jig', price: 1200, blurb: 'Hops along the bottom like a snack.', bonus: { pBottom: 0.3, attract: { bottom: 0.35, catfish: 0.2 } }, color: '#4a2a6a', accent: '#f0a030' }),
  L({ id: 'trap', name: 'Trap Bobber', price: 1400, blurb: 'Fish slip away a lot slower.', bonus: { escapeSlow: 0.35 }, color: '#5a8a3a', accent: '#f0e060' }),
  L({ id: 'crank', name: 'Crankbait', price: 1500, blurb: 'Wobbles like an injured minnow.', bonus: { pPredator: 0.3, attract: { predator: 0.35, bass: 0.2 } }, color: '#f07a2a', accent: '#2a3a8a' }),
  L({ id: 'feather', name: 'Feather Fly', price: 1600, blurb: 'Hand-tied. Trout weep openly.', bonus: { pTrout: 0.3, perfectWindow: 0.35, attract: { trout: 0.45 } }, color: '#a85a3a', accent: '#f0d080' }),
  L({ id: 'spoon', name: 'Silver Spoon', price: 1800, blurb: 'Big flash for big fish.', bonus: { fishSize: 0.14, pBig: 0.12 }, color: '#e0e4ea', accent: '#e84a4a' }),
  L({ id: 'treasure', name: 'Treasure Hunter', price: 1900, blurb: 'A tiny magnet with big dreams.', bonus: { treasureChance: 0.14, treasureValue: 0.3 }, color: '#e8c040', accent: '#6a3a1a' }),
  L({ id: 'bubble', name: 'Bubble Buster', price: 2000, blurb: 'Tuned to the fizz.', bonus: { bubbleBoost: 0.45, pBubble: 0.3 }, color: '#6ad0f0', accent: '#f8f8ff' }),
  L({ id: 'glowsquid', name: 'Glow Squid', price: 2100, blurb: 'Glows in the dark, wiggles in the salt.', bonus: { pNight: 0.25, pSalt: 0.2, attract: { salt: 0.25 } }, color: '#8a4af0', accent: '#6af0d0' }),
  L({ id: 'splash', name: 'Splash Bomb', price: 1700, blurb: 'With friends: your shove recharges fast and spooks their fish.', bonus: { shoveCd: 0.5, shoveSpook: 0.3 }, color: '#4aa0e0', accent: '#f8f8ff' }),
  L({ id: 'anchor', name: 'Anchor Weight', price: 1500, blurb: 'Heavy as sin. With friends: shoves barely rock you.', bonus: { steady: 0.6, escapeSlow: 0.05 }, color: '#4a4a52', accent: '#c8a050' }),
  L({ id: 'barbed', name: 'Barbed Hook', price: 2600, blurb: 'Once it’s on, it’s ON.', bonus: { fishCalm: 0.22, reelSpeed: 0.1, hookSave: 0.25 }, color: '#8a8a8a', accent: '#c83a3a' }),
];

export const BAITS: Gear[] = [
  B({ id: 'worms', name: 'Worms', price: 0, blurb: 'Classic. Wiggly. Free.', bonus: {}, color: '#d87a8a', accent: '#8a3a4a' }),
  B({ id: 'crickets', name: 'Crickets', price: 700, blurb: 'Chirpy little snacks.', bonus: { pSmall: 0.2, biteSpeed: 0.1, attract: { panfish: 0.4 } }, color: '#5a4a2a', accent: '#a88a4a' }),
  B({ id: 'dough', name: 'Dough Balls', price: 800, blurb: 'Grandma’s recipe. Carp can’t say no.', bonus: { attract: { carp: 0.7, catfish: 0.25 }, pCarp: 0.2 }, color: '#f0e0b0', accent: '#c8a060' }),
  B({ id: 'minnows', name: 'Live Minnows', price: 1100, blurb: 'Big fish eat little fish.', bonus: { attract: { predator: 0.45 }, fishSize: 0.06 }, color: '#9aa88a', accent: '#5d6a52' }),
  B({ id: 'stink', name: 'Stinkbait', price: 1200, blurb: 'You’ll smell it in the truck for a week.', bonus: { attract: { catfish: 0.8, bottom: 0.2, junk: 0.3 }, pCatfish: 0.15 }, color: '#7a6a3a', accent: '#a8a040' }),
  B({ id: 'shrimp', name: 'Shrimp', price: 1300, blurb: 'Everything in the sea loves shrimp.', bonus: { attract: { salt: 0.55 }, biteSpeed: 0.1 }, color: '#f0907a', accent: '#c85a4a' }),
  B({ id: 'glowgrub', name: 'Glow Grubs', price: 1500, blurb: 'Night lights for night bites.', bonus: { rareChance: 0.15, pNight: 0.15, biteSpeed: 0.12 }, color: '#a0f070', accent: '#4a8a3a' }),
  B({ id: 'magnet', name: 'Magnet Bait', price: 1700, blurb: 'Attracts treasure. And boots.', bonus: { treasureChance: 0.15, attract: { junk: 0.6 } }, color: '#c83a3a', accent: '#d8d8d8' }),
  B({ id: 'deluxe', name: 'Deluxe Bait', price: 1900, blurb: 'Fancy. Fish line up for it.', bonus: { biteSpeed: 0.35 }, color: '#f0c0e0', accent: '#a04a8a' }),
  B({ id: 'chum', name: 'Chum Slick', price: 1600, blurb: 'With friends: the anglers you shove have their fish go wild.', bonus: { shoveSpook: 0.7, biteSpeed: 0.05 }, color: '#a84a3a', accent: '#5a2a1a' }),
  B({ id: 'wild', name: 'Wild Bait', price: 2500, blurb: 'Sometimes two fish want it at once.', bonus: { doubleCatch: 0.14 }, color: '#e0702a', accent: '#5a2a1a' }),
  B({ id: 'corn', name: 'Golden Corn', price: 3200, blurb: 'Rare fish only eat at the best restaurants.', bonus: { rareChance: 0.4, quality: 0.06 }, color: '#f5c542', accent: '#c88a1a' }),
];

export const ALL_GEAR: Gear[] = [...RODS, ...LURES, ...BAITS];
export const GEAR: Record<string, Gear> = Object.fromEntries(ALL_GEAR.map((g) => [g.id, g]));
export const STARTER = { rod: 'bamboo', lure: 'bobber', bait: 'worms' };
export const KIND_NAME: Record<GearKind, string> = { rod: 'Rod', lure: 'Lure', bait: 'Bait' };
