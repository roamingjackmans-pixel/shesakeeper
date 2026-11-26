// Points for one catch. Base points by species and size, then the additive "+%" pile (gear, perks, charms, streak),
// then the multipliers that stack: quality stars, the mission, lightning. The catch card shows the working.
import { CHARM, type CatchView } from '../data/charms';
import { FISH, avgCm, type TimeOfDay, type Weather } from '../data/fish';
import { missionMatch } from './mission';
import { BASE, type Derived, type StatKey, type Stats, type Tag } from './stats';
import type { Catch, Mission } from './types';

export const QUALITY_MULT = [1, 1.25, 1.5, 2];
export const QUALITY_NAME = ['', 'Silver', 'Gold', 'Rainbow'];

const TAG_STAT: Partial<Record<Tag, StatKey>> = {
  panfish: 'pPanfish',
  bass: 'pBass',
  trout: 'pTrout',
  catfish: 'pCatfish',
  carp: 'pCarp',
  predator: 'pPredator',
  bottom: 'pBottom',
  salt: 'pSalt',
  prehistoric: 'pPrehistoric',
  junk: 'pJunk',
  rare: 'pRare',
};

export interface ScoreCtx {
  stats: Stats;
  d: Derived;
  mission: Mission;
  missionDouble: boolean;
  charms: string[];
  time: TimeOfDay;
  weather: Weather;
  streak: number;
  /** species caught earlier this hole */
  seen: string[];
  /** catches earlier this hole */
  count: number;
  holeLen: number;
  charged: boolean;
}

export type CatchCore = Pick<Catch, 'id' | 'cm' | 'kg' | 'q' | 'perfect' | 'perfectCast' | 'bullseye' | 'bubble' | 'long' | 'treasure' | 'reelTime' | 't'>;

export function missionMultFor(m: Mission, st: Stats, double: boolean): number {
  return Math.max(1, (m.mult + st.missionMult) * (double ? 2 : 1));
}

export function scoreCatch(c: CatchCore, x: ScoreCtx): { points: number; why: string[]; mission: boolean } {
  const sp = FISH[c.id]!;
  const junk = sp.tags.includes('junk');
  const why: string[] = [];
  const sizeFactor = junk ? 1 : Math.pow(c.cm / avgCm(sp), 1.5);
  let base = sp.pts * sizeFactor;
  for (const id of x.charms) base += CHARM[id]?.flat ?? 0;

  const st = x.stats;
  let pct = st.points;
  for (const t of sp.tags) {
    const k = TAG_STAT[t];
    if (k) pct += st[k];
  }
  if (!junk && c.cm < BASE.smallCm) pct += st.pSmall;
  if (!junk && c.cm >= BASE.bigCm) pct += st.pBig;
  if (x.time === 'dusk' || x.time === 'night') pct += st.pNight;
  else pct += st.pDay;
  if (x.weather === 'rain' || x.weather === 'fog' || x.weather === 'snow' || x.weather === 'storm') pct += st.pWeather;
  if (c.perfect) pct += st.pPerfectCatch;
  if (c.perfectCast) pct += st.pPerfectCast;
  if (c.long) pct += st.pLongCast;
  if (c.bubble) pct += st.pBubble;
  if (x.count === 0) pct += st.pFirstCatch;
  if (c.treasure) pct += st.pTreasure;
  const mission = missionMatch(x.mission.rule, c, x.seen);
  const view: CatchView = {
    cm: c.cm,
    sizeFrac: (c.cm - sp.cm[0]) / Math.max(1, sp.cm[1] - sp.cm[0]),
    perfect: c.perfect,
    bubble: c.bubble,
    junk,
    rare: sp.tags.includes('rare'),
    mission,
    reelTime: c.reelTime,
    t: c.t,
    holeLen: x.holeLen,
    speciesBefore: x.seen.length,
    newSpecies: !x.seen.includes(c.id),
  };
  let charmPct = 0;
  for (const id of x.charms) charmPct += CHARM[id]?.mult?.(view) ?? 0;
  const streakPct = Math.min(BASE.streakMax, x.streak) * x.d.streakStep;
  if (Math.abs(pct) >= 0.005) why.push(`${pct >= 0 ? '+' : '−'}${Math.round(Math.abs(pct) * 100)}% gear & perks`);
  if (charmPct > 0) why.push(`+${Math.round(charmPct * 100)}% charms`);
  if (streakPct > 0) why.push(`Streak ${x.streak} +${Math.round(streakPct * 100)}%`);
  const add = Math.max(0.1, 1 + pct + charmPct + streakPct);
  const qm = QUALITY_MULT[c.q] ?? 1;
  if (c.q > 0) why.push(`${QUALITY_NAME[c.q]} ★ ×${qm}`);
  let mm = 1;
  if (mission) {
    mm = missionMultFor(x.mission, st, x.missionDouble);
    why.push(`Mission ×${+mm.toFixed(2)}`);
  }
  const lightning = x.charged ? 2 : 1;
  if (x.charged) why.push('Lightning ×2');
  const points = Math.max(1, Math.round(base * add * qm * mm * lightning));
  return { points, why, mission };
}
