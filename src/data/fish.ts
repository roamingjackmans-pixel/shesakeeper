// Every fish (and a little junk) that can bite, and Her: Marlene, the legendary golden fish of every water.
// pts is the points for an average-sized fish of normal quality; size, quality, mission and gear change it.
import type { Tag } from '../core/stats';

export type Behavior = 'mixed' | 'dart' | 'smooth' | 'sinker' | 'floater' | 'legend';
export type Biome = 'pond' | 'lake' | 'river' | 'swamp' | 'coast' | 'ice' | 'tarn';
export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';
export type Weather = 'clear' | 'cloudy' | 'rain' | 'fog' | 'snow' | 'storm';

export type Shape = 'torpedo' | 'deep' | 'eel' | 'flat' | 'cat' | 'gar' | 'puffer' | 'tuna' | 'sturgeon' | 'tiny' | 'boot' | 'can' | 'duck' | 'bottle' | 'legend';

export interface FishArt {
  shape: Shape;
  body: string;
  belly: string;
  fin: string;
  pattern?: 'stripes' | 'spots' | 'bars' | 'speckle' | 'lateral' | 'patches' | 'chain' | 'none';
  pat?: string;
  tail?: 'fork' | 'round' | 'square' | 'moon';
  /** body height ÷ length */
  h?: number;
}

export interface Species {
  id: string;
  name: string;
  biomes: Biome[];
  times?: TimeOfDay[];
  weather?: Weather[];
  cm: [number, number];
  pts: number;
  diff: number;
  beh: Behavior;
  w: number;
  tags: Tag[];
  art: FishArt;
  blurb: string;
  /** kg per (length in metres)³ */
  k: number;
}

const F = (s: Omit<Species, 'k'> & { k?: number }): Species => ({ k: 11, ...s });

export const SPECIES: Species[] = [
  // ---------------------------------------------------------------- panfish and little ones
  F({ id: 'minnow', name: 'Fathead Minnow', biomes: ['pond', 'lake', 'river'], cm: [4, 9], pts: 6, diff: 6, beh: 'smooth', w: 55, tags: ['panfish'], art: { shape: 'tiny', body: '#9aa88a', belly: '#e9e4c8', fin: '#7d8a6c', pattern: 'lateral', pat: '#5d6a52', tail: 'fork' }, blurb: 'Bait that got ambitious.' }),
  F({ id: 'smelt', name: 'Rainbow Smelt', biomes: ['ice', 'lake', 'coast'], cm: [12, 22], pts: 14, diff: 18, beh: 'dart', w: 40, tags: ['panfish'], art: { shape: 'tiny', body: '#a9c9d6', belly: '#f2f6f8', fin: '#8fb0bf', pattern: 'lateral', pat: '#c69be0', tail: 'fork', h: 0.2 }, blurb: 'Smells faintly of cucumber. Really.' }),
  F({ id: 'sculpin', name: 'Mottled Sculpin', biomes: ['tarn', 'river', 'ice'], cm: [6, 15], pts: 12, diff: 14, beh: 'sinker', w: 35, tags: ['bottom', 'panfish'], art: { shape: 'cat', body: '#7a6a52', belly: '#cbbd98', fin: '#5f523f', pattern: 'patches', pat: '#4a3f30', tail: 'round', h: 0.3 }, blurb: 'All head, all attitude.' }),
  F({ id: 'bluegill', name: 'Bluegill', biomes: ['pond', 'lake', 'swamp'], cm: [10, 25], pts: 18, diff: 20, beh: 'mixed', w: 50, tags: ['panfish'], art: { shape: 'deep', body: '#5f8f7a', belly: '#f0b04a', fin: '#41685a', pattern: 'bars', pat: '#3f6455', tail: 'square', h: 0.55 }, blurb: 'The friendliest fish in any pond.' }),
  F({ id: 'pumpkinseed', name: 'Pumpkinseed', biomes: ['pond', 'lake'], cm: [9, 20], pts: 22, diff: 22, beh: 'mixed', w: 32, tags: ['panfish'], art: { shape: 'deep', body: '#c4a24a', belly: '#f07c3a', fin: '#7a8f5a', pattern: 'speckle', pat: '#3ea0b8', tail: 'square', h: 0.58 }, blurb: 'Dressed for a party nobody invited it to.' }),
  F({ id: 'crappie', name: 'Black Crappie', biomes: ['pond', 'lake', 'swamp', 'ice'], cm: [15, 35], pts: 30, diff: 28, beh: 'dart', w: 34, tags: ['panfish'], art: { shape: 'deep', body: '#b8bfa8', belly: '#eef0e0', fin: '#6d7262', pattern: 'speckle', pat: '#2f3329', tail: 'square', h: 0.5 }, blurb: 'Despite the name, delicious.' }),
  F({ id: 'perch', name: 'Yellow Perch', biomes: ['lake', 'ice', 'pond'], cm: [12, 30], pts: 26, diff: 25, beh: 'smooth', w: 42, tags: ['panfish', 'predator'], art: { shape: 'torpedo', body: '#d9b83c', belly: '#f6eccb', fin: '#e0703a', pattern: 'bars', pat: '#4f5a2c', tail: 'fork', h: 0.32 }, blurb: 'Stripes like a referee, calls like one too.' }),
  // ---------------------------------------------------------------- bass
  F({ id: 'largemouth', name: 'Largemouth Bass', biomes: ['pond', 'lake', 'swamp'], cm: [25, 62], pts: 70, diff: 45, beh: 'mixed', w: 26, tags: ['bass', 'predator'], art: { shape: 'torpedo', body: '#6b8f3c', belly: '#e8e6c0', fin: '#4f6c2c', pattern: 'lateral', pat: '#2f4a1c', tail: 'square', h: 0.36 }, blurb: 'Mouth first, questions later.', k: 14 }),
  F({ id: 'smallmouth', name: 'Smallmouth Bass', biomes: ['lake', 'river'], cm: [22, 52], pts: 75, diff: 52, beh: 'dart', w: 20, tags: ['bass', 'predator'], art: { shape: 'torpedo', body: '#9a7a3c', belly: '#e9dcb4', fin: '#7a5c28', pattern: 'bars', pat: '#5a4220', tail: 'square', h: 0.36 }, blurb: 'Pound for pound, the angriest fish alive.', k: 14 }),
  F({ id: 'striper', name: 'Striped Bass', biomes: ['coast', 'river'], cm: [40, 110], pts: 150, diff: 60, beh: 'mixed', w: 13, tags: ['bass', 'predator', 'salt'], art: { shape: 'torpedo', body: '#9fb3bf', belly: '#f2f4f2', fin: '#6f8592', pattern: 'stripes', pat: '#2c3a44', tail: 'fork', h: 0.3 }, blurb: 'Pinstripes. Clearly management.', k: 12 }),
  // ---------------------------------------------------------------- trout and friends
  F({ id: 'rainbow', name: 'Rainbow Trout', biomes: ['river', 'lake', 'tarn'], cm: [25, 62], pts: 65, diff: 45, beh: 'mixed', w: 25, tags: ['trout'], art: { shape: 'torpedo', body: '#8fa36f', belly: '#f3ece0', fin: '#7c8a5c', pattern: 'lateral', pat: '#e2607a', tail: 'square', h: 0.28 }, blurb: 'Wears the whole sunset on one side.' }),
  F({ id: 'brook', name: 'Brook Trout', biomes: ['river', 'tarn'], cm: [15, 38], pts: 50, diff: 40, beh: 'dart', w: 24, tags: ['trout'], art: { shape: 'torpedo', body: '#3f5a3a', belly: '#f08a3c', fin: '#e0603a', pattern: 'spots', pat: '#f2d64a', tail: 'square', h: 0.27 }, blurb: 'A painting that swims.' }),
  F({ id: 'brown', name: 'Brown Trout', biomes: ['river', 'lake'], cm: [30, 75], pts: 90, diff: 55, beh: 'smooth', w: 15, tags: ['trout', 'predator'], art: { shape: 'torpedo', body: '#a5843f', belly: '#efe0b0', fin: '#7d6130', pattern: 'spots', pat: '#3b2a18', tail: 'square', h: 0.28 }, times: ['dusk', 'night', 'dawn'], blurb: 'Comes out after dark like a jazz musician.' }),
  F({ id: 'cutthroat', name: 'Cutthroat Trout', biomes: ['tarn', 'river'], cm: [25, 55], pts: 80, diff: 48, beh: 'mixed', w: 16, tags: ['trout'], art: { shape: 'torpedo', body: '#a3a06a', belly: '#f0e0c0', fin: '#8a7a4a', pattern: 'spots', pat: '#3a3324', tail: 'square', h: 0.27 }, blurb: 'The red slash is a fashion statement.' }),
  F({ id: 'laketrout', name: 'Lake Trout', biomes: ['ice', 'tarn', 'lake'], cm: [40, 100], pts: 130, diff: 55, beh: 'sinker', w: 11, tags: ['trout', 'predator'], art: { shape: 'torpedo', body: '#5d6d6a', belly: '#e6e8de', fin: '#4a5552', pattern: 'speckle', pat: '#e8ecd8', tail: 'fork', h: 0.26 }, blurb: 'Lives deep, thinks deeper.', k: 9 }),
  F({ id: 'golden', name: 'Golden Trout', biomes: ['tarn'], cm: [20, 45], pts: 220, diff: 66, beh: 'dart', w: 6, tags: ['trout', 'rare'], art: { shape: 'torpedo', body: '#f2b632', belly: '#f05a3a', fin: '#f0c860', pattern: 'bars', pat: '#b8742a', tail: 'square', h: 0.28 }, blurb: 'Only lives where the air runs out.' }),
  F({ id: 'char', name: 'Arctic Char', biomes: ['tarn', 'ice'], cm: [30, 70], pts: 150, diff: 56, beh: 'smooth', w: 9, tags: ['trout', 'rare'], art: { shape: 'torpedo', body: '#5a6f7c', belly: '#ef6a4a', fin: '#f0f0e8', pattern: 'spots', pat: '#f4b8a8', tail: 'fork', h: 0.27 }, blurb: 'Too cool for the rest of the lake.' }),
  F({ id: 'grayling', name: 'Grayling', biomes: ['tarn', 'river'], cm: [25, 45], pts: 110, diff: 50, beh: 'dart', w: 10, tags: ['trout'], art: { shape: 'torpedo', body: '#8b8fa3', belly: '#e8e6ee', fin: '#8a5aa8', pattern: 'speckle', pat: '#3a3a4a', tail: 'fork', h: 0.26 }, blurb: 'Carries a sail it never uses.' }),
  F({ id: 'chinook', name: 'Chinook Salmon', biomes: ['river', 'coast'], cm: [50, 115], pts: 200, diff: 70, beh: 'dart', w: 7, tags: ['trout', 'salt', 'rare'], weather: ['rain', 'fog'], art: { shape: 'torpedo', body: '#7d8e9c', belly: '#eef0ee', fin: '#5d6e7c', pattern: 'speckle', pat: '#2e3640', tail: 'fork', h: 0.27 }, blurb: 'Swam a thousand miles to be rude to you.' }),
  F({ id: 'whitefish', name: 'Lake Whitefish', biomes: ['ice', 'lake'], cm: [25, 55], pts: 60, diff: 35, beh: 'smooth', w: 20, tags: ['bottom'], art: { shape: 'torpedo', body: '#c6ccd0', belly: '#f6f8f8', fin: '#9aa4aa', pattern: 'none', tail: 'fork', h: 0.27 }, blurb: 'Shy. Would rather you looked at the perch.' }),
  // ---------------------------------------------------------------- catfish, carp and bottom dwellers
  F({ id: 'channelcat', name: 'Channel Catfish', biomes: ['river', 'lake', 'swamp', 'pond'], cm: [30, 90], pts: 85, diff: 40, beh: 'sinker', w: 24, tags: ['catfish', 'bottom'], art: { shape: 'cat', body: '#7d8a92', belly: '#e6e6e0', fin: '#5d6870', pattern: 'speckle', pat: '#3a4248', tail: 'fork', h: 0.24 }, blurb: 'Tastes with its whole body. Rude, really.', k: 9 }),
  F({ id: 'flathead', name: 'Flathead Catfish', biomes: ['river', 'swamp'], cm: [50, 130], pts: 180, diff: 60, beh: 'sinker', w: 8, tags: ['catfish', 'bottom', 'predator'], times: ['dusk', 'night'], art: { shape: 'cat', body: '#8a7444', belly: '#e6d8a8', fin: '#6a5434', pattern: 'patches', pat: '#4a3a22', tail: 'square', h: 0.24 }, blurb: 'A lawn chair with a mouth.', k: 10 }),
  F({ id: 'bluecat', name: 'Blue Catfish', biomes: ['river', 'lake'], cm: [60, 150], pts: 240, diff: 66, beh: 'sinker', w: 5, tags: ['catfish', 'bottom', 'rare'], times: ['night'], art: { shape: 'cat', body: '#5a7a9a', belly: '#e0e8ee', fin: '#3f5a74', pattern: 'none', tail: 'fork', h: 0.25 }, blurb: 'The river’s oldest grumbler.', k: 10 }),
  F({ id: 'carp', name: 'Common Carp', biomes: ['pond', 'lake', 'river'], cm: [35, 90], pts: 70, diff: 46, beh: 'sinker', w: 24, tags: ['carp', 'bottom'], art: { shape: 'deep', body: '#b8963c', belly: '#ecd890', fin: '#8a5a2c', pattern: 'speckle', pat: '#7a5a28', tail: 'fork', h: 0.38 }, blurb: 'A golden retriever in a fish suit.', k: 15 }),
  F({ id: 'koi', name: 'Runaway Koi', biomes: ['pond'], cm: [30, 75], pts: 200, diff: 38, beh: 'smooth', w: 4, tags: ['carp', 'rare'], times: ['dawn', 'day'], art: { shape: 'deep', body: '#f4f0e6', belly: '#f8f6ee', fin: '#f4f0e6', pattern: 'patches', pat: '#e8502c', tail: 'fork', h: 0.36 }, blurb: 'Escaped a fancy garden. Never going back.', k: 15 }),
  F({ id: 'flounder', name: 'Summer Flounder', biomes: ['coast'], cm: [25, 65], pts: 80, diff: 40, beh: 'sinker', w: 18, tags: ['bottom', 'salt'], art: { shape: 'flat', body: '#9a845c', belly: '#f2ece0', fin: '#7a6644', pattern: 'spots', pat: '#4a3a24', tail: 'round', h: 0.5 }, blurb: 'Both eyes on one side. Sees everything coming.', k: 12 }),
  F({ id: 'halibut', name: 'Pacific Halibut', biomes: ['coast'], cm: [70, 210], pts: 420, diff: 76, beh: 'sinker', w: 3, tags: ['bottom', 'salt', 'rare'], art: { shape: 'flat', body: '#6a6458', belly: '#f2f0ea', fin: '#544e44', pattern: 'patches', pat: '#46403a', tail: 'moon', h: 0.48 }, blurb: 'A barn door that holds grudges.', k: 12 }),
  F({ id: 'sturgeon', name: 'Lake Sturgeon', biomes: ['lake', 'river'], cm: [100, 220], pts: 520, diff: 80, beh: 'sinker', w: 2, tags: ['bottom', 'prehistoric', 'rare'], art: { shape: 'sturgeon', body: '#6a6a5c', belly: '#d8d6c8', fin: '#545448', pattern: 'chain', pat: '#d8d6c8', tail: 'fork', h: 0.16 }, blurb: 'Saw the dinosaurs. Unimpressed.', k: 6 }),
  F({ id: 'burbot', name: 'Burbot', biomes: ['ice', 'river'], cm: [30, 80], pts: 120, diff: 48, beh: 'sinker', w: 10, tags: ['bottom', 'eel'], times: ['dusk', 'night'], art: { shape: 'eel', body: '#6e6a3c', belly: '#d8d0a0', fin: '#5a562e', pattern: 'patches', pat: '#3e3a20', tail: 'round', h: 0.16 }, blurb: 'Half eel, half cod, all confusing.', k: 6 }),
  F({ id: 'eel', name: 'American Eel', biomes: ['river', 'swamp', 'coast'], cm: [40, 120], pts: 120, diff: 56, beh: 'floater', w: 10, tags: ['eel', 'bottom'], times: ['dusk', 'night'], art: { shape: 'eel', body: '#5a5a2a', belly: '#d8d290', fin: '#4a4a22', pattern: 'none', tail: 'round', h: 0.1 }, blurb: 'Noodle with a plan.', k: 2.5 }),
  // ---------------------------------------------------------------- predators and prehistoric
  F({ id: 'pike', name: 'Northern Pike', biomes: ['lake', 'river', 'ice'], cm: [45, 120], pts: 140, diff: 60, beh: 'dart', w: 12, tags: ['predator'], art: { shape: 'gar', body: '#5e7a3c', belly: '#e8ead0', fin: '#a8702c', pattern: 'spots', pat: '#d8e0a8', tail: 'fork', h: 0.18 }, blurb: 'A torpedo with teeth and opinions.', k: 7 }),
  F({ id: 'pickerel', name: 'Chain Pickerel', biomes: ['swamp', 'pond'], cm: [30, 65], pts: 95, diff: 52, beh: 'dart', w: 14, tags: ['predator'], art: { shape: 'gar', body: '#6e7a3a', belly: '#e8e8c8', fin: '#5a6430', pattern: 'chain', pat: '#2e3418', tail: 'fork', h: 0.17 }, blurb: 'Wears a chain-link fence. Edgy.', k: 7 }),
  F({ id: 'muskie', name: 'Muskellunge', biomes: ['lake'], cm: [70, 140], pts: 360, diff: 82, beh: 'dart', w: 3, tags: ['predator', 'rare'], art: { shape: 'gar', body: '#8a8a5a', belly: '#ecead4', fin: '#a85a2c', pattern: 'bars', pat: '#4a4a2a', tail: 'fork', h: 0.18 }, blurb: 'The fish of ten thousand casts. This is one.', k: 7 }),
  F({ id: 'walleye', name: 'Walleye', biomes: ['lake', 'river', 'ice'], cm: [30, 75], pts: 95, diff: 46, beh: 'smooth', w: 18, tags: ['predator'], times: ['dawn', 'dusk', 'night'], art: { shape: 'torpedo', body: '#b8a24a', belly: '#f0ead0', fin: '#8a7a3a', pattern: 'patches', pat: '#5a4e24', tail: 'fork', h: 0.26 }, blurb: 'Those glassy eyes see in the dark. They judge.' }),
  F({ id: 'bowfin', name: 'Bowfin', biomes: ['swamp'], cm: [40, 85], pts: 110, diff: 56, beh: 'mixed', w: 12, tags: ['predator', 'prehistoric'], art: { shape: 'eel', body: '#5e6a3a', belly: '#d8d8a8', fin: '#4a8a5a', pattern: 'patches', pat: '#3a4224', tail: 'round', h: 0.22 }, blurb: 'Can breathe air. Chooses violence.', k: 9 }),
  F({ id: 'gar', name: 'Longnose Gar', biomes: ['swamp', 'river'], cm: [60, 150], pts: 160, diff: 60, beh: 'floater', w: 8, tags: ['predator', 'prehistoric'], art: { shape: 'gar', body: '#7a8250', belly: '#e0e0c0', fin: '#6a7240', pattern: 'spots', pat: '#3a3e24', tail: 'round', h: 0.12 }, blurb: 'A fish wearing a pool noodle.', k: 4 }),
  F({ id: 'alligatorgar', name: 'Alligator Gar', biomes: ['swamp'], cm: [120, 250], pts: 480, diff: 86, beh: 'floater', w: 2, tags: ['predator', 'prehistoric', 'rare'], art: { shape: 'gar', body: '#5a6a4a', belly: '#d8d8b8', fin: '#4a5a3a', pattern: 'spots', pat: '#2a3220', tail: 'round', h: 0.15 }, blurb: 'Not an alligator. Don’t tell it.', k: 5 }),
  // ---------------------------------------------------------------- the sea
  F({ id: 'sardine', name: 'Sardine', biomes: ['coast'], cm: [10, 20], pts: 10, diff: 16, beh: 'dart', w: 50, tags: ['salt', 'panfish'], art: { shape: 'tiny', body: '#5a8ab0', belly: '#eef4f8', fin: '#7aa0c0', pattern: 'spots', pat: '#2a4a6a', tail: 'fork', h: 0.22 }, blurb: 'Usually comes in a can. This one escaped.' }),
  F({ id: 'mackerel', name: 'Atlantic Mackerel', biomes: ['coast'], cm: [25, 45], pts: 35, diff: 40, beh: 'dart', w: 36, tags: ['salt'], art: { shape: 'torpedo', body: '#3a8a8a', belly: '#f0f4f2', fin: '#2a6a6a', pattern: 'stripes', pat: '#1a3a4a', tail: 'fork', h: 0.24 }, blurb: 'Tiger stripes, goldfish attention span.' }),
  F({ id: 'snapper', name: 'Red Snapper', biomes: ['coast'], cm: [30, 80], pts: 130, diff: 55, beh: 'mixed', w: 12, tags: ['salt', 'predator'], art: { shape: 'deep', body: '#e05a4a', belly: '#f8d0c0', fin: '#c84a3a', pattern: 'none', tail: 'fork', h: 0.4 }, blurb: 'Snaps. As advertised.', k: 15 }),
  F({ id: 'sheepshead', name: 'Sheepshead', biomes: ['coast'], cm: [25, 60], pts: 90, diff: 50, beh: 'mixed', w: 14, tags: ['salt', 'bottom'], art: { shape: 'deep', body: '#c8c8b8', belly: '#f0f0e8', fin: '#5a5a54', pattern: 'bars', pat: '#2a2a28', tail: 'fork', h: 0.48 }, blurb: 'Has human teeth. Nobody knows why.', k: 18 }),
  F({ id: 'puffer', name: 'Pufferfish', biomes: ['coast'], cm: [10, 30], pts: 140, diff: 68, beh: 'floater', w: 6, tags: ['salt', 'rare'], art: { shape: 'puffer', body: '#d8c070', belly: '#f6eccc', fin: '#c0a050', pattern: 'spots', pat: '#6a5a2a', tail: 'round', h: 0.8 }, blurb: 'Handle with extreme confidence.', k: 30 }),
  F({ id: 'tuna', name: 'Bluefin Tuna', biomes: ['coast'], cm: [100, 260], pts: 650, diff: 90, beh: 'dart', w: 1.4, tags: ['salt', 'predator', 'rare'], art: { shape: 'tuna', body: '#1e3a6a', belly: '#e0e8f0', fin: '#f0c830', pattern: 'none', tail: 'moon', h: 0.3 }, blurb: 'Basically a muscle car. Fast, loud, expensive.', k: 16 }),
  // ---------------------------------------------------------------- junk
  F({ id: 'boot', name: 'Old Boot', biomes: ['pond', 'lake', 'river', 'swamp', 'coast', 'ice', 'tarn'], cm: [26, 34], pts: 8, diff: 4, beh: 'sinker', w: 7, tags: ['junk'], art: { shape: 'boot', body: '#6a4a2c', belly: '#4a3220', fin: '#2a1c12' }, blurb: 'Size 11. The other one is still out there.', k: 0 }),
  F({ id: 'can', name: 'Rusty Can', biomes: ['pond', 'lake', 'river', 'swamp', 'coast'], cm: [10, 14], pts: 4, diff: 3, beh: 'sinker', w: 6, tags: ['junk'], art: { shape: 'can', body: '#a8a8a0', belly: '#c84a3a', fin: '#6a6a64' }, blurb: 'Beans, probably. Long ago.', k: 0 }),
  F({ id: 'duck', name: 'Rubber Duck', biomes: ['pond', 'lake', 'river', 'coast'], cm: [8, 12], pts: 60, diff: 10, beh: 'floater', w: 1.2, tags: ['junk', 'rare'], art: { shape: 'duck', body: '#f6d02c', belly: '#f08a2c', fin: '#f6d02c' }, blurb: 'Lost at sea in 1992. Finally home.', k: 0 }),
  F({ id: 'bottle', name: 'Message in a Bottle', biomes: ['coast', 'lake', 'river'], cm: [20, 26], pts: 90, diff: 12, beh: 'floater', w: 1.2, tags: ['junk', 'rare'], art: { shape: 'bottle', body: '#7ab89a', belly: '#f2ead0', fin: '#5a8a6a' }, blurb: '“She’s out there. — G.”', k: 0 }),
];

/** Her. Can turn up at any hole, in a golden ripple. */
export const MARLENE: Species = {
  id: 'marlene',
  name: 'Marlene',
  biomes: ['pond', 'lake', 'river', 'swamp', 'coast', 'ice', 'tarn'],
  cm: [180, 320],
  pts: 6000,
  diff: 96,
  beh: 'legend',
  w: 0,
  tags: ['rare'],
  art: { shape: 'legend', body: '#f5c542', belly: '#fff1c4', fin: '#ff7a4a', pattern: 'speckle', pat: '#fff6d8', tail: 'moon', h: 0.3 },
  blurb: 'The one every angler swears they saw. She’s real. She’s a keeper.',
  k: 9,
};

export const ALL_FISH: Species[] = [...SPECIES, MARLENE];
export const FISH: Record<string, Species> = Object.fromEntries(ALL_FISH.map((s) => [s.id, s]));

export function weightKg(sp: Species, cm: number): number {
  if (sp.k <= 0) return Math.round(cm * 0.02 * 10) / 10;
  return Math.round(sp.k * Math.pow(cm / 100, 3) * 100) / 100;
}

export function avgCm(sp: Species): number {
  return (sp.cm[0] + sp.cm[1]) / 2;
}
