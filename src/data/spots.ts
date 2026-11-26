// Fishing holes: the kinds of water, their names, the times of day and weather they get, and how they look.
import type { Biome, TimeOfDay, Weather } from './fish';

export interface BiomeDef {
  id: Biome;
  name: string;
  names: string[];
  weather: Weather[];
  /** water colours: near, far, and the highlight */
  water: [string, string, string];
  /** what stands along the shore and on the far bank */
  shore: 'dock' | 'rocks' | 'sand' | 'ice' | 'mud' | 'pier' | 'meadow';
  far: 'hills' | 'pines' | 'mountains' | 'cypress' | 'sea' | 'snowpines' | 'reeds';
  /** lily pads, reeds, rocks... floating or poking out of the water */
  props: ('lily' | 'reeds' | 'rocks' | 'log' | 'buoy' | 'ice' | 'cypress' | 'duck')[];
  radio: string;
}

export const BIOMES: Record<Biome, BiomeDef> = {
  pond: {
    id: 'pond',
    name: 'Pond',
    names: ['Frog Hollow Pond', 'Millpond', 'Lily Pad Pond', 'Grandma’s Pond', 'Duckweed Pond', 'Turtle Pond'],
    weather: ['clear', 'clear', 'cloudy', 'rain', 'fog'],
    water: ['#2a6e74', '#4a96a0', '#b0e8e0'],
    shore: 'dock',
    far: 'hills',
    props: ['lily', 'lily', 'reeds', 'duck', 'log'],
    radio: 'Nice and easy out at the pond. Bluegill are biting, bass are sulking.',
  },
  lake: {
    id: 'lake',
    name: 'Lake',
    names: ['Mirror Lake', 'Loon Lake', 'Pinecone Lake', 'Big Bear Lake', 'Echo Lake', 'Long Lake'],
    weather: ['clear', 'clear', 'cloudy', 'rain', 'fog', 'storm'],
    water: ['#1f5f86', '#3f86aa', '#a8d8f0'],
    shore: 'dock',
    far: 'pines',
    props: ['rocks', 'log', 'buoy', 'reeds'],
    radio: 'Lake’s glassy today. Somebody saw a muskie the size of a canoe. Somebody always does.',
  },
  river: {
    id: 'river',
    name: 'River',
    names: ['Rattlesnake River', 'Cold Creek', 'Bent Elbow River', 'Whiskey Bend', 'Otter Run', 'Two Bridges'],
    weather: ['clear', 'cloudy', 'rain', 'rain', 'fog', 'storm'],
    water: ['#2c6474', '#4a8a94', '#c0e8ec'],
    shore: 'rocks',
    far: 'pines',
    props: ['rocks', 'rocks', 'log', 'reeds'],
    radio: 'River’s running high and fast. Trout like that. Catfish like it more.',
  },
  swamp: {
    id: 'swamp',
    name: 'Bayou',
    names: ['Gator Bayou', 'Cypress Bend', 'Moss Hollow', 'Bullfrog Bayou', 'Old Shrimp Slough'],
    weather: ['cloudy', 'fog', 'fog', 'rain', 'clear', 'storm'],
    water: ['#3a4a2a', '#5a6a3a', '#a8b878'],
    shore: 'mud',
    far: 'cypress',
    props: ['cypress', 'lily', 'reeds', 'log'],
    radio: 'Muggy down on the bayou. Gar are rolling. Mind the gators. Kidding. Mostly.',
  },
  coast: {
    id: 'coast',
    name: 'Coast',
    names: ['Saltwind Pier', 'Gull Rock Pier', 'Driftwood Jetty', 'Lighthouse Point', 'Barnacle Pier'],
    weather: ['clear', 'cloudy', 'rain', 'fog', 'storm', 'clear'],
    water: ['#1a5a8a', '#3a8ab8', '#c8ecf8'],
    shore: 'pier',
    far: 'sea',
    props: ['buoy', 'rocks'],
    radio: 'Swells are gentle off the pier. Mackerel by the bucket, and something big out past the buoys.',
  },
  ice: {
    id: 'ice',
    name: 'Ice Lake',
    names: ['Frostbite Lake', 'Shanty Flats', 'Icebox Lake', 'Polar Bear Pond', 'Chattering Teeth Lake'],
    weather: ['clear', 'cloudy', 'snow', 'snow', 'fog'],
    water: ['#2a5a7a', '#4a7a9a', '#d8f0ff'],
    shore: 'ice',
    far: 'snowpines',
    props: ['ice', 'ice', 'rocks'],
    radio: 'Minus twelve out on the ice. The perch don’t mind. Your fingers will.',
  },
  tarn: {
    id: 'tarn',
    name: 'Mountain Tarn',
    names: ['Cloudtop Tarn', 'Eagle’s Nest Tarn', 'Skyglass Tarn', 'Hermit Tarn', 'Last Switchback Tarn'],
    weather: ['clear', 'clear', 'cloudy', 'fog', 'snow', 'rain'],
    water: ['#1a6a7a', '#3a9aa8', '#c8f8f8'],
    shore: 'meadow',
    far: 'mountains',
    props: ['rocks', 'rocks', 'reeds'],
    radio: 'Long climb to the tarn, but the goldens are up there. Air’s thin, so is the patience.',
  },
};

export const BIOME_IDS = Object.keys(BIOMES) as Biome[];
export const TIMES: TimeOfDay[] = ['dawn', 'day', 'dusk', 'night'];
export const TIME_NAMES: Record<TimeOfDay, string> = { dawn: 'Dawn', day: 'Midday', dusk: 'Dusk', night: 'Night' };
export const WEATHER_NAMES: Record<Weather, string> = { clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain', fog: 'Fog', snow: 'Snow', storm: 'Storm' };
export const WEATHER_ICON: Record<Weather, string> = { clear: '☀', cloudy: '☁', rain: '🌧', fog: '🌫', snow: '❄', storm: '⛈' };
export const TIME_ICON: Record<TimeOfDay, string> = { dawn: '🌅', day: '🌞', dusk: '🌇', night: '🌙' };
