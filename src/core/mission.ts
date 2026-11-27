// Missions: every fishing hole has one, rolled from the water's fish. Fish that match score the mission's
// multiplier; reach the goal and the whole hole scores ×1.5. The goal changes every hole, so the right gear does too.
import { FISH, type Species, type TimeOfDay, type Weather } from '../data/fish';
import type { Rng } from './rng';
import { TAG_NAMES, type Tag } from './stats';
import type { Catch, Mission, MissionRule } from './types';

export const MISSION_BONUS = 1.5;

/** gear that suits each kind of fish */
const TAG_GEAR: Partial<Record<Tag, string[]>> = {
  panfish: ['ultralight', 'popper', 'crickets'],
  bass: ['crank', 'minnows'],
  trout: ['fly', 'feather'],
  catfish: ['bottom', 'jig', 'stink'],
  carp: ['dough', 'bottom'],
  predator: ['crank', 'minnows'],
  bottom: ['bottom', 'jig', 'stink'],
  salt: ['surf', 'shrimp', 'glowsquid'],
  prehistoric: ['heavy', 'minnows', 'crank'],
  eel: ['jig', 'stink', 'glowgrub'],
  rare: ['corn', 'glowgrub'],
  junk: ['magnet'],
};

interface Ctx {
  pool: Species[];
  time: TimeOfDay;
  weather: Weather;
  /** how long the hole is: goals are sized for it */
  secs?: number;
}

type Maker = (rng: Rng, c: Ctx) => Mission | null;

/** a goal written for a four-minute hole, sized to this one (never below 1) */
const g = (c: Ctx, n: number): number => Math.max(1, Math.round((n * (c.secs ?? 240)) / 240));
const pl = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

const realFish = (c: Ctx): Species[] => c.pool.filter((s) => !s.tags.includes('junk'));

/** how much of what bites here (by spawn weight) is a species that passes the test */
function share(c: Ctx, test: (s: Species) => boolean): number {
  let all = 0;
  let hit = 0;
  for (const s of c.pool) {
    all += s.w;
    if (test(s)) hit += s.w;
  }
  return all > 0 ? hit / all : 0;
}

const MAKERS: { id: string; w: number; make: Maker }[] = [
  {
    id: 'small',
    w: 1.2,
    make: (_r, c) => {
      const cm = 22;
      if (realFish(c).filter((s) => s.cm[0] < cm - 2).length < 2) return null;
      const goal = g(c, 6);
      return { id: 'small', title: 'Small Fry', text: `Fish under ${cm} cm score ×3`, goalText: `Catch ${goal} small fry`, rule: { k: 'maxCm', cm }, mult: 3, goal, hint: 'Ultralight rods, Poppers and Crickets go after the little ones.', fits: ['ultralight', 'popper', 'crickets'] };
    },
  },
  {
    id: 'trophy',
    w: 1.2,
    make: (_r, c) => {
      const big = realFish(c).filter((s) => s.cm[1] >= 75).length >= 2 ? 60 : 45;
      if (realFish(c).filter((s) => s.cm[1] >= big + 10).length < 2) return null;
      const goal = g(c, 3);
      return { id: 'trophy', title: 'Trophy Hunt', text: `Fish ${big} cm or longer score ×3`, goalText: `Land ${pl(goal, 'trophy', 'trophies')}`, rule: { k: 'minCm', cm: big }, mult: 3, goal, hint: 'Big lures and live minnows bring the big ones. A heavy rod helps you land them.', fits: ['heavy', 'spoon', 'minnows'] };
    },
  },
  {
    id: 'wanted',
    w: 1.4,
    make: (r, c) => {
      // a species common enough to find in one hole; the goal is how many you'd expect to see
      const options = realFish(c).filter((s) => share(c, (x) => x.id === s.id) >= 0.06);
      if (!options.length) return null;
      const s = r.pick(options);
      const tag = s.tags.find((t) => TAG_GEAR[t]);
      const sh = share(c, (x) => x.id === s.id);
      const goal = g(c, sh >= 0.2 ? 3 : sh >= 0.1 ? 2 : 1);
      return { id: 'wanted', title: 'Most Wanted', text: `${s.name} scores ×5`, goalText: `Catch ${goal} ${s.name}`, rule: { k: 'species', id: s.id }, mult: 5, goal, hint: `${s.dist ? `${s.name} only bites ${s.dist} m or more out: bring the reach. ` : ''}${tag ? `It counts as ${TAG_NAMES[tag]}: bait and lures for them help.` : `Keep casting. ${s.name} is out there.`}`, fits: tag ? TAG_GEAR[tag]! : [] };
    },
  },
  {
    id: 'family',
    w: 1.4,
    make: (r, c) => {
      const tags = (['catfish', 'trout', 'bass', 'panfish', 'predator', 'bottom', 'salt', 'carp', 'prehistoric', 'eel'] as Tag[]).filter(
        (t) => realFish(c).filter((s) => s.tags.includes(t)).length >= 2 && share(c, (s) => s.tags.includes(t)) >= 0.12,
      );
      if (!tags.length) return null;
      const tag = r.pick(tags);
      const name = TAG_NAMES[tag];
      const sh = share(c, (s) => s.tags.includes(tag));
      const goal = g(c, sh >= 0.4 ? 5 : sh >= 0.25 ? 4 : 3);
      return { id: 'family', title: 'Family Reunion', text: `All ${name} score ×3`, goalText: `Catch ${goal} ${name}`, rule: { k: 'tag', tag }, mult: 3, goal, hint: `Bait and lures that attract ${name} make this easy.`, fits: TAG_GEAR[tag] ?? [] };
    },
  },
  {
    id: 'collector',
    w: 0.9,
    make: (_r, c) => {
      const n = realFish(c).length;
      if (n < 5) return null;
      const goal = Math.min(g(c, 5), n - 2);
      return { id: 'collector', title: 'Variety Pack', text: 'The first of each species scores ×2.5', goalText: `Catch ${goal} different species`, rule: { k: 'newSpecies' }, mult: 2.5, goal, hint: 'Fast bites mean more fish to choose from. Golden Corn finds the odd ones.', fits: ['spinner', 'deluxe', 'corn'] };
    },
  },
  {
    id: 'perfect',
    w: 1,
    make: (_r, c) => {
      const goal = g(c, 4);
      return { id: 'perfect', title: 'Perfectionist', text: 'Perfect catches (fish never left the bar) score ×3', goalText: `Make ${pl(goal, 'perfect catch', 'perfect catches')}`, rule: { k: 'perfect' }, mult: 3, goal, hint: 'A bigger catch bar makes it easy: Cork Bobbers, Fiberglass and Carbon rods.', fits: ['cork', 'carbon', 'fiberglass', 'lead', 'barbed'] };
    },
  },
  {
    id: 'bubble',
    w: 1,
    make: (_r, c) => {
      const goal = g(c, 5);
      return { id: 'bubble', title: 'Bubble Trouble', text: 'Fish from bubbles score ×2.5', goalText: `Catch ${pl(goal, 'fish', 'fish')} from bubbles`, rule: { k: 'bubble' }, mult: 2.5, goal, hint: 'The Bubble Buster lure and a long-range rod help you claim them.', fits: ['bubble', 'surf'] };
    },
  },
  {
    id: 'long',
    w: 0.8,
    make: (_r, c) => {
      const goal = g(c, 5);
      return { id: 'long', title: 'Long Shot', text: 'Fish from casts at 75%+ of your range score ×2.5', goalText: `Catch ${goal} from long casts`, rule: { k: 'long' }, mult: 2.5, goal, hint: 'The Surf Caster flies; a slower cast meter makes it easy.', fits: ['surf', 'fly'] };
    },
  },
  {
    id: 'heavy',
    w: 0.8,
    make: (_r, c) => {
      // heavy for this water: what a fish in the top fifth of what bites here weighs
      const big = (kg: number) => share(c, (s) => s.k > 0 && s.k * Math.pow((s.cm[0] + (s.cm[1] - s.cm[0]) * 0.75) / 100, 3) >= kg);
      const kg = big(2) >= 0.2 ? 2 : big(1) >= 0.2 ? 1 : 0.5;
      if (big(kg) < 0.1) return null;
      const goal = g(c, 2);
      return { id: 'heavy', title: 'Heavyweight', text: `Fish weighing ${kg} kg or more score ×2.5`, goalText: `Land ${pl(goal, 'heavyweight', 'heavyweights')}`, rule: { k: 'minKg', kg }, mult: 2.5, goal, hint: 'Spoons and minnows grow fish; a heavy rod holds them.', fits: ['heavy', 'spoon', 'minnows'] };
    },
  },
  {
    id: 'quick',
    w: 0.8,
    make: (_r, c) => {
      const goal = g(c, 5);
      return { id: 'quick', title: 'Quick Hands', text: 'Fish reeled in under 6 seconds score ×2.5', goalText: `Reel in ${pl(goal, 'quick one', 'quick ones')}`, rule: { k: 'quick', s: 6 }, mult: 2.5, goal, hint: 'Reel speed is king: Heavy and Carbon rods, Barbed Hooks.', fits: ['heavy', 'carbon', 'barbed'] };
    },
  },
  {
    id: 'quality',
    w: 0.8,
    make: (_r, c) => {
      const goal = g(c, 4);
      return { id: 'quality', title: 'Gold Standard', text: 'Gold-star catches or better score ×3', goalText: `Land ${goal} gold-star fish`, rule: { k: 'quality', q: 2 }, mult: 3, goal, hint: 'Perfect catches, perfect casts and big fish earn stars. Golden gear helps.', fits: ['golden', 'corn', 'fly'] };
    },
  },
  {
    id: 'numbers',
    w: 0.9,
    make: (_r, c) => {
      const goal = g(c, 15);
      return { id: 'numbers', title: 'Numbers Game', text: 'Every fish scores ×1.5', goalText: `Catch ${goal} fish`, rule: { k: 'any' }, mult: 1.5, goal, hint: 'Speed wins: Spinners, Deluxe Bait, Wild Bait for doubles.', fits: ['spinner', 'deluxe', 'wild', 'crickets'] };
    },
  },
  {
    id: 'treasure',
    w: 0.6,
    make: (_r, c) => {
      const goal = g(c, 2);
      return { id: 'treasure', title: 'Treasure Hunt', text: 'Fish that bring a treasure chest score ×3', goalText: `Open ${pl(goal, 'treasure chest', 'treasure chests')}`, rule: { k: 'treasure' }, mult: 3, goal, hint: 'The Treasure Hunter lure and Magnet Bait find chests.', fits: ['treasure', 'magnet'] };
    },
  },
  {
    id: 'night',
    w: 0.8,
    make: (_r, c) => {
      if (c.time !== 'night' && c.time !== 'dusk') return null;
      if (realFish(c).filter((s) => s.tags.includes('predator')).length < 2) return null;
      const goal = g(c, 4);
      return { id: 'night', title: 'Night Hunters', text: 'Predators score ×3', goalText: `Catch ${pl(goal, 'predator', 'predators')}`, rule: { k: 'tag', tag: 'predator' }, mult: 3, goal, hint: 'Crankbaits and live minnows. The Glow Rod loves the dark.', fits: ['crank', 'minnows', 'glow'] };
    },
  },
];

export function makeMission(rng: Rng, ctx: Ctx, avoid: string[] = []): Mission {
  for (let tries = 0; tries < 30; tries++) {
    const m = rng.weighted(MAKERS, (x) => (avoid.includes(x.id) ? 0.05 : x.w));
    const made = m.make(rng, ctx);
    if (made) return made;
  }
  return MAKERS.find((m) => m.id === 'numbers')!.make(rng, ctx)!;
}

/** does a catch count for the mission? `seen` is the species already caught this hole (before this one) */
export function missionMatch(rule: MissionRule, c: Pick<Catch, 'id' | 'cm' | 'kg' | 'q' | 'perfect' | 'bubble' | 'long' | 'treasure' | 'reelTime'>, seen: readonly string[]): boolean {
  const sp = FISH[c.id];
  const junk = !!sp?.tags.includes('junk');
  switch (rule.k) {
    case 'maxCm':
      return !junk && c.cm < rule.cm;
    case 'minCm':
      return !junk && c.cm >= rule.cm;
    case 'species':
      return c.id === rule.id;
    case 'tag':
      return !!sp?.tags.includes(rule.tag);
    case 'newSpecies':
      return !junk && !seen.includes(c.id);
    case 'perfect':
      return c.perfect && !junk;
    case 'bubble':
      return c.bubble && !junk;
    case 'long':
      return c.long && !junk;
    case 'minKg':
      return !junk && c.kg >= rule.kg;
    case 'quick':
      return !junk && c.reelTime < rule.s;
    case 'quality':
      return !junk && c.q >= rule.q;
    case 'any':
      return !junk;
    case 'treasure':
      return c.treasure;
  }
}
