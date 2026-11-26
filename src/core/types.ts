// Shared plain-JSON types (they cross the co-op relay and sessionStorage, so no classes, Maps or Sets).
import type { Biome, TimeOfDay, Weather } from '../data/fish';
import type { Tag } from './stats';

export type MissionRule =
  | { k: 'maxCm'; cm: number }
  | { k: 'minCm'; cm: number }
  | { k: 'species'; id: string }
  | { k: 'tag'; tag: Tag }
  | { k: 'newSpecies' }
  | { k: 'perfect' }
  | { k: 'bubble' }
  | { k: 'long' }
  | { k: 'minKg'; kg: number }
  | { k: 'quick'; s: number }
  | { k: 'quality'; q: number }
  | { k: 'any' }
  | { k: 'treasure' };

export interface Mission {
  id: string;
  title: string;
  /** what counts and what it's worth: "Fish under 22 cm score ×3" */
  text: string;
  /** "Catch 6 of them: hole score ×1.5" */
  goalText: string;
  rule: MissionRule;
  mult: number;
  goal: number;
  /** a nudge about gear that helps */
  hint: string;
  /** gear ids that suit it (a ✓ in the loadout) */
  fits: string[];
}

export interface HoleSpec {
  idx: number;
  seed: number;
  biome: Biome;
  name: string;
  time: TimeOfDay;
  weather: Weather;
  mission: Mission;
  seconds: number;
  /** 0..1: She shows up when this is under the best legend chance on the lake */
  legendRoll: number;
  /** seconds into the hole when her ripple appears */
  legendAt: number;
  /** -1..1 when the Gusty modifier is on */
  wind: number;
}

export interface RunConfig {
  seed: number;
  /** 'solo' | 'daily' | 'coop' */
  mode: 'solo' | 'daily' | 'coop';
  /** the daily's date, YYYY-MM-DD */
  date?: string;
  mods: string[];
  holes: HoleSpec[];
}

/** one fish (or boot) landed */
export interface Catch {
  id: string;
  cm: number;
  kg: number;
  /** 0 normal, 1 silver, 2 gold, 3 rainbow */
  q: number;
  perfect: boolean;
  perfectCast: boolean;
  bullseye: boolean;
  bubble: boolean;
  long: boolean;
  treasure: boolean;
  reelTime: number;
  /** seconds into the hole */
  t: number;
  points: number;
  mission: boolean;
  /** first of its species this hole */
  fresh: boolean;
  /** first catch ever of this species (fish log) */
  firstEver?: boolean;
  /** a record size for the fish log */
  record?: boolean;
  /** the multipliers that made the points, for the catch card */
  why: string[];
}

export interface Loadout {
  rod: string;
  lure: string;
  bait: string;
  /** ornament ids on your section of the dash (3 slots) */
  dash: (string | null)[];
  /** run charm ids active at this hole (3 slots) */
  charms: string[];
}

export interface AnglerLook {
  hat: number;
  hatColor: number;
  jacket: number;
  skin: number;
  hair: number;
}

export interface HoleResult {
  points: number;
  catches: Catch[];
  missionDone: boolean;
  /** points after the mission bonus */
  total: number;
  treasureCash: number;
  marlene: boolean;
}
