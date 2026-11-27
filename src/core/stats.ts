// One stat system for everything that changes how you fish: rods, lures, bait, dash ornament perks and curses,
// run charms, daily modifiers. Every source adds numbers to the same keys; the fishing and scoring code reads the
// totals. Percent stats are additive (two +10% bar perks make +20%), like Balatro's +mult.

export type Tag =
  | 'panfish'
  | 'bass'
  | 'trout'
  | 'catfish'
  | 'carp'
  | 'predator'
  | 'bottom'
  | 'salt'
  | 'prehistoric'
  | 'junk'
  | 'eel'
  | 'rare';

export const TAG_NAMES: Record<Tag, string> = {
  panfish: 'panfish',
  bass: 'bass',
  trout: 'trout',
  catfish: 'catfish',
  carp: 'carp',
  predator: 'predators',
  bottom: 'bottom feeders',
  salt: 'saltwater fish',
  prehistoric: 'prehistoric fish',
  junk: 'junk',
  eel: 'eels',
  rare: 'rare fish',
};

/** how a stat is shown: % (+12%), abs points on a 100 scale (+8%), s (+0.2 s), $ (+$40), n (+1) */
type Fmt = 'pct' | 'chance' | 'n' | 'cash' | 'flag' | 'mult';

interface StatDef {
  fmt: Fmt;
  /** text for a positive value ({v} is the number) */
  pos: string;
  /** text for a negative value */
  neg: string;
  /** a bigger number is better for the player (false: e.g. none yet, kept for clarity) */
  short: string;
}

const pct = (pos: string, neg: string, short: string): StatDef => ({ fmt: 'pct', pos, neg, short });

export const STATS = {
  barSize: pct('+{v} catch bar size', '−{v} catch bar size', 'Bar'),
  reelSpeed: pct('+{v} reel speed', '−{v} reel speed', 'Reel'),
  escapeSlow: pct('Fish escape {v} slower', 'Fish escape {v} faster', 'Grip'),
  fishCalm: pct('Fish dart {v} less', 'Fish dart {v} more', 'Calm'),
  noBounce: { fmt: 'flag', pos: 'The catch bar doesn’t bounce', neg: 'The catch bar bounces', short: 'No bounce' } as StatDef,
  castControl: pct('Cast meter {v} slower', 'Cast meter {v} faster', 'Control'),
  castDist: pct('+{v} cast distance', '−{v} cast distance', 'Range'),
  perfectWindow: pct('+{v} perfect-cast window', '−{v} perfect-cast window', 'Perfect'),
  hookWindow: pct('+{v} time to hook a bite', '−{v} time to hook a bite', 'Hook'),
  biteSpeed: pct('Bites come {v} faster', 'Bites come {v} slower', 'Bite'),
  bubbleBoost: pct('+{v} bubble power', '−{v} bubble power', 'Bubbles'),
  bubbleRate: pct('Bubbles appear {v} more often', 'Bubbles appear {v} less often', 'Bubble rate'),
  treasureChance: { fmt: 'chance', pos: '+{v} treasure chance', neg: '−{v} treasure chance', short: 'Treasure' } as StatDef,
  treasureValue: pct('Treasure is worth {v} more', 'Treasure is worth {v} less', 'Loot'),
  fishSize: pct('Fish are {v} bigger', 'Fish are {v} smaller', 'Size'),
  rareChance: pct('+{v} rare fish chance', '−{v} rare fish chance', 'Rare'),
  quality: { fmt: 'chance', pos: '+{v} catch quality', neg: '−{v} catch quality', short: 'Quality' } as StatDef,
  doubleCatch: { fmt: 'chance', pos: '{v} chance to catch two', neg: '{v} less chance to catch two', short: 'Double' } as StatDef,
  hookSave: { fmt: 'chance', pos: '{v} chance a missed bite stays hooked', neg: '{v} less hook save', short: 'Save' } as StatDef,
  legend: { fmt: 'chance', pos: '+{v} chance She shows up', neg: '−{v} chance She shows up', short: 'Legend' } as StatDef,
  points: pct('+{v} points on every fish', '−{v} points on every fish', 'Points'),
  pSmall: pct('Small fish (under 22 cm) +{v} points', 'Small fish (under 22 cm) −{v} points', 'Small'),
  pBig: pct('Big fish (60 cm+) +{v} points', 'Big fish (60 cm+) −{v} points', 'Big'),
  pPanfish: pct('Panfish +{v} points', 'Panfish −{v} points', 'Panfish'),
  pBass: pct('Bass +{v} points', 'Bass −{v} points', 'Bass'),
  pTrout: pct('Trout +{v} points', 'Trout −{v} points', 'Trout'),
  pCatfish: pct('Catfish +{v} points', 'Catfish −{v} points', 'Catfish'),
  pCarp: pct('Carp +{v} points', 'Carp −{v} points', 'Carp'),
  pPredator: pct('Predators +{v} points', 'Predators −{v} points', 'Predators'),
  pBottom: pct('Bottom feeders +{v} points', 'Bottom feeders −{v} points', 'Bottom'),
  pSalt: pct('Saltwater fish +{v} points', 'Saltwater fish −{v} points', 'Salt'),
  pPrehistoric: pct('Prehistoric fish +{v} points', 'Prehistoric fish −{v} points', 'Ancient'),
  pJunk: pct('Junk +{v} points', 'Junk −{v} points', 'Junk'),
  pRare: pct('Rare fish +{v} points', 'Rare fish −{v} points', 'Rare pts'),
  pNight: pct('+{v} points at dusk and night', '−{v} points at dusk and night', 'Night'),
  pDay: pct('+{v} points at dawn and day', '−{v} points at dawn and day', 'Day'),
  pWeather: pct('+{v} points in rain, fog, snow or storm', '−{v} points in rain, fog, snow or storm', 'Weather'),
  pPerfectCatch: pct('Perfect catches +{v} points', 'Perfect catches −{v} points', 'Perfect catch'),
  pPerfectCast: pct('Perfect casts +{v} points', 'Perfect casts −{v} points', 'Perfect cast'),
  pLongCast: pct('Long casts (75%+) +{v} points', 'Long casts (75%+) −{v} points', 'Long cast'),
  pBubble: pct('Fish from bubbles +{v} points', 'Fish from bubbles −{v} points', 'Bubble pts'),
  pFirstCatch: pct('First fish of each hole +{v} points', 'First fish of each hole −{v} points', 'First'),
  pTreasure: pct('Fish that bring treasure +{v} points', 'Fish that bring treasure −{v} points', 'Lucky'),
  missionMult: { fmt: 'mult', pos: 'Mission multiplier +×{v}', neg: 'Mission multiplier −×{v}', short: 'Mission' } as StatDef,
  streak: { fmt: 'chance', pos: '+{v} streak bonus per fish in a row', neg: '−{v} streak bonus per fish in a row', short: 'Streak' } as StatDef,
  shove: pct('Your shoves hit {v} harder', 'Your shoves hit {v} softer', 'Shove'),
  shoveReach: pct('+{v} shove reach', '−{v} shove reach', 'Shove reach'),
  shoveCd: pct('Shove recharges {v} faster', 'Shove recharges {v} slower', 'Shove recharge'),
  shoveSpook: pct('Shoved anglers’ fish slip {v} faster', 'Shoved anglers’ fish slip {v} slower', 'Spook'),
  steady: pct('Shoves rock you {v} less', 'Shoves rock you {v} more', 'Steady'),
  shopDiscount: pct('Shop prices {v} lower', 'Shop prices {v} higher', 'Discount'),
  rerollDiscount: pct('Rerolls cost {v} less', 'Rerolls cost {v} more', 'Reroll'),
  freeReroll: { fmt: 'n', pos: '{v} free reroll every shop', neg: '{v} fewer free rerolls', short: 'Free reroll' } as StatDef,
  sellBonus: pct('Ornaments sell for {v} more', 'Ornaments sell for {v} less', 'Sell'),
  startCash: { fmt: 'cash', pos: 'Start every run with {v}', neg: 'Start every run {v} in debt', short: 'Cash' } as StatDef,
} satisfies Record<string, StatDef>;

export type StatKey = keyof typeof STATS;
export const STAT_KEYS = Object.keys(STATS) as StatKey[];

export type Stats = Record<StatKey, number> & { attract: Partial<Record<Tag, number>> };
export type StatBonus = Partial<Record<StatKey, number>> & { attract?: Partial<Record<Tag, number>> };

export function emptyStats(): Stats {
  const s = { attract: {} } as Stats;
  for (const k of STAT_KEYS) s[k] = 0;
  return s;
}

export function addStats(into: Stats, b: StatBonus | undefined, times = 1): Stats {
  if (!b) return into;
  for (const k of STAT_KEYS) {
    const v = b[k];
    if (typeof v === 'number' && Number.isFinite(v)) into[k] += v * times;
  }
  if (b.attract)
    for (const [t, v] of Object.entries(b.attract) as [Tag, number][]) into.attract[t] = (into.attract[t] ?? 0) + v * times;
  return into;
}

function fmtNum(fmt: Fmt, v: number): string {
  const a = Math.abs(v);
  if (fmt === 'pct' || fmt === 'chance') return `${Math.round(a * 100)}%`;
  if (fmt === 'cash') return `$${Math.round(a)}`;
  if (fmt === 'mult') return a.toFixed(a < 1 ? 2 : 1).replace(/\.?0+$/, '');
  return String(Math.round(a));
}

/** "+18% catch bar size" */
export function describeStat(k: StatKey, v: number): string {
  const d = STATS[k] as StatDef;
  if (d.fmt === 'flag') return v > 0 ? d.pos : d.neg;
  return (v >= 0 ? d.pos : d.neg).replace('{v}', fmtNum(d.fmt, v));
}

export function describeAttract(t: Tag, v: number): string {
  return v >= 0 ? `Attracts ${TAG_NAMES[t]} (+${Math.round(v * 100)}%)` : `Scares off ${TAG_NAMES[t]} (−${Math.round(-v * 100)}%)`;
}

/** every line a bonus adds, for tooltips and cards */
export function describeBonus(b: StatBonus | undefined): string[] {
  if (!b) return [];
  const out: string[] = [];
  for (const k of STAT_KEYS) {
    const v = b[k];
    if (typeof v === 'number' && v !== 0) out.push(describeStat(k, v));
  }
  if (b.attract) for (const [t, v] of Object.entries(b.attract) as [Tag, number][]) if (v) out.push(describeAttract(t, v));
  return out;
}

// ------------------------------------------------------------------ the numbers the fishing rules use

export const BASE = {
  /** catch bar height as a share of the track */
  bar: 0.22,
  barMin: 0.08,
  barMax: 0.62,
  /** catch progress per second with the fish in the bar, and lost per second outside it */
  fill: 0.15,
  drain: 0.17,
  startProgress: 0.3,
  /** the cast meter goes 0 → 1 → 0 in this many seconds */
  castPeriod: 1.35,
  /** how far a full-power cast goes (metres) */
  castMax: 30,
  castMin: 4,
  perfectWindow: 0.045,
  hookWindow: 0.85,
  /** seconds to wait for a bite outside bubbles */
  biteMin: 4,
  biteMax: 10,
  bubbleBite: 0.28,
  bullseyeBite: 0.16,
  treasureChance: 0.1,
  streakStep: 0.04,
  streakMax: 10,
  /** per hole; three holes a run makes about one run in three */
  legendChance: 0.12,
  /** small fish are shorter than this, big ones at least this long (cm) */
  smallCm: 22,
  bigCm: 60,
  holeSeconds: 150,
  /** co-op shoves: reach along the shore (m), seconds to recharge, how long the catch bar wobbles, extra slip */
  shoveRange: 7,
  shoveCooldown: 14,
  shoveTime: 1.8,
  shoveSpook: 0.25,
  /** how fast an angler walks along the shore (m/s) */
  walk: 7,
};

/** the stats as the rules use them: the totals turned into the actual numbers */
export function derived(s: Stats) {
  const p = (v: number, lo = -0.85) => 1 + Math.max(lo, v);
  return {
    bar: Math.min(BASE.barMax, Math.max(BASE.barMin, BASE.bar * p(s.barSize))),
    fill: BASE.fill * p(s.reelSpeed),
    drain: BASE.drain * Math.max(0.25, 1 - s.escapeSlow),
    fishSpeed: 1 / p(s.fishCalm, -0.6),
    bounce: s.noBounce > 0 ? 0 : 0.45,
    castPeriod: BASE.castPeriod * p(s.castControl, -0.6),
    castMax: BASE.castMax * p(s.castDist, -0.6),
    perfectWindow: Math.min(0.2, BASE.perfectWindow * p(s.perfectWindow)),
    hookWindow: Math.max(0.3, BASE.hookWindow * p(s.hookWindow)),
    biteMul: 1 / p(s.biteSpeed, -0.6),
    bubbleBite: BASE.bubbleBite / p(s.bubbleBoost, -0.6),
    treasure: Math.max(0, Math.min(0.9, BASE.treasureChance + s.treasureChance)),
    treasureValue: p(s.treasureValue),
    size: p(s.fishSize, -0.6),
    rare: p(s.rareChance, -0.8),
    quality: s.quality,
    double: Math.max(0, Math.min(0.6, s.doubleCatch)),
    hookSave: Math.max(0, Math.min(0.75, s.hookSave)),
    legend: Math.max(0, Math.min(1, BASE.legendChance + s.legend)),
    streakStep: Math.max(0, BASE.streakStep + s.streak),
    /** co-op shoves: how hard yours land, how far you can reach (m), the recharge (s), the extra slip, how much
     *  of an incoming shove you take */
    shoveStr: p(s.shove, -0.8),
    shoveRange: BASE.shoveRange * p(s.shoveReach, -0.8),
    shoveCooldown: BASE.shoveCooldown / p(s.shoveCd, -0.6),
    shoveSpook: Math.max(0, BASE.shoveSpook + s.shoveSpook),
    shoveTaken: Math.max(0.2, Math.min(2, 1 - s.steady)),
  };
}
export type Derived = ReturnType<typeof derived>;
