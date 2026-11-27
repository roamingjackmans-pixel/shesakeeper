// The tutorial: a practice pond with no clock, an easy catch bar and a coach's card that walks you through aiming,
// walking, casting, the bite, reeling, bubbles and shoving a rival (Gus, a practice buddy). It ends with the gear
// guide: what a rod, a lure, bait, a dash ornament and a charm each do.
import { show } from '../app';
import { audio } from '../audio/audio';
import type { AEvent, AnglerView } from '../core/angler';
import { Rng } from '../core/rng';
import { buildHole, loadoutStats } from '../core/run';
import { addStats } from '../core/stats';
import { CHARM } from '../data/charms';
import { GEAR, STARTER } from '../data/gear';
import { onTick } from '../render/canvas';
import { gearPic, ornPic } from '../render/pics';
import { displayName, saveSoon, session } from '../session';
import { stopDemo } from './demo';
import { h, modal } from './dom';
import { FishingSession, SEAT_COLORS } from './fishing';
import { garage } from './garage';
import { charmIcon } from './widgets';

type Step = 'aim' | 'walk' | 'cast' | 'bite' | 'reel' | 'bubble' | 'shove' | 'shoved';

const STEPS: { id: Step; title: string; text: string }[] = [
  { id: 'aim', title: 'Aim', text: 'Move the mouse over the water. The dotted line is your cast, marked in metres from the shore: the further out, the bigger the fish.' },
  { id: 'walk', title: 'Walk the shore', text: 'Press A and D (or ← and →) to walk left and right for a better angle.' },
  { id: 'cast', title: 'Cast', text: 'Hold the mouse button (or Space): the meter swings up and down. Let go to cast. The ring shows where it will land.' },
  { id: 'bite', title: 'The bite', text: 'Wait… little dips are only nibbles. When the bobber plunges and a ! pops up, click to hook it!' },
  { id: 'reel', title: 'Reel it in', text: 'Hold to lift the green bar, let go to let it fall. Keep the fish inside the bar until the meter on the right fills up.' },
  { id: 'bubble', title: 'Bubbles', text: 'See that fizz? A bubble spot: bites come in a second or two, and better fish live there. Cast into it and land what bites.' },
  { id: 'shove', title: 'Shove a rival', text: 'That’s Gus, reeling one in. With friends you can mess with each other: walk over to Gus (D) and press E to shove him!' },
  { id: 'shoved', title: 'Gotcha!', text: 'A shove makes their catch bar wobble and their fish slip for a moment. Some gear shoves harder or further; some shrugs shoves off. Last thing: what all your gear does.' },
];

const SEEN = 'tutorial';

export function tutorialSeen(): boolean {
  return session.profile.tips.includes(SEEN);
}

function markSeen(): void {
  if (!tutorialSeen()) {
    session.profile.tips.push(SEEN);
    saveSoon();
  }
}

export function startTutorial(): void {
  stopDemo();
  audio.music('fish');
  const p = session.profile;
  // a calm, sunny practice pond that never ends; easy settings so the lesson is about the controls
  const base = buildHole(new Rng('tutorial-pond'), 0, []);
  const spec = { ...base, biome: 'pond' as const, name: 'Practice Pond', time: 'day' as const, weather: 'clear' as const, seconds: 99999, legendAt: 1e9, legendRoll: 1 };
  const stats = addStats(loadoutStats({ ...STARTER, dash: [], charms: [] }, [], []), { barSize: 0.7, biteSpeed: 1.2, hookWindow: 0.8, castControl: 0.35 });
  const me = session.user?.id ?? 'local';
  const GUS_X = 9;
  show((root) => {
    let step = 0;
    let gusJolt = 0;
    let aimMoved = 0;
    let lastAim = 0;
    let startX = 0;
    let bubbleLanded = false;
    let finished = false;
    const f = new FishingSession(root, {
      spec,
      holes: 1,
      mods: [],
      stats,
      charms: [],
      seed: 4242,
      me,
      seats: [
        { id: me, name: displayName(), look: p.look, color: SEAT_COLORS[0]!, x: 0, lure: STARTER.lure },
        { id: 'gus', name: 'Gus', look: { hat: 2, hatColor: 4, jacket: 3, skin: 3, hair: 4 }, color: SEAT_COLORS[1]!, x: GUS_X, lure: 'bobber' },
      ],
      authority: true,
      runScore: 0,
      cash: () => 0,
      tutorial: true,
      onEvent: (e) => onEvent(e),
      onDone: () => {},
      onQuit: () => end(false),
      onShove: (to) => {
        if (to !== 'gus') return;
        gusJolt = 1.8;
        if (STEPS[step]!.id === 'shove') {
          f.banner('Hey!', 'Gus didn’t like that.', 1400);
          advance();
        }
      },
    });
    // no bubbles until the lesson asks for one
    f.world.bubbles = [];
    f.world.rate = 0;
    // development only: the tutorial's fishing, for the automated play-through
    if (import.meta.env.DEV) (window as unknown as { __sakTutorial: unknown }).__sakTutorial = f;
    startX = f.angler.x;
    lastAim = f.angler.aim;

    // ---- the coach's card
    const count = h('span.chip');
    const title = h('h3', { style: 'font-size:28px' });
    const text = h('div', { style: 'font-size:18px;font-weight:600;line-height:1.35' });
    const note = h('div', { style: 'font-weight:800;color:#c0503a;min-height:22px' });
    const next = h('button.primary', { style: 'display:none', onclick: () => end(true) }, 'Next: the gear guide ▶');
    const card = h(
      'div.panel.col',
      // top left, clear of the catch card (top centre) and the banners
      { style: 'position:absolute;left:22px;top:18px;width:500px;gap:6px;padding:16px 20px;pointer-events:auto;z-index:5' },
      h('div.row', count, h('div.grow'), h('button.tiny', { onclick: () => end(false) }, 'Skip tutorial')),
      title,
      text,
      note,
      next,
    );
    root.appendChild(card);
    const paint = (msg = '') => {
      const s = STEPS[step]!;
      count.textContent = `Step ${Math.min(step + 1, STEPS.length - 1)} of ${STEPS.length - 1}`;
      title.textContent = s.title;
      text.textContent = s.text;
      note.textContent = msg;
      next.style.display = s.id === 'shoved' ? '' : 'none';
      card.style.animation = 'none';
      void card.offsetWidth;
      card.style.animation = 'pop .25s';
    };
    const advance = () => {
      step = Math.min(STEPS.length - 1, step + 1);
      audio.sfx('ready');
      if (STEPS[step]!.id === 'bubble') putBubble();
      paint();
    };
    const back = (to: Step, msg: string) => {
      step = STEPS.findIndex((s) => s.id === to);
      paint(msg);
    };
    const putBubble = () => {
      // a bubble spot a little to your right, well inside your reach
      f.world.bubbles = [{ id: 999, x: f.angler.x + 3, z: 18, r: 3, cap: 2, born: f.world.t, life: 1e9 }];
    };
    const onEvent = (e: AEvent) => {
      const id = STEPS[step]!.id;
      if (e.k === 'land') {
        if (id === 'cast') advance();
        if (id === 'bubble' && e.bubble) bubbleLanded = true;
      } else if (e.k === 'hook') {
        if (id === 'bite') advance();
      } else if (e.k === 'miss') {
        if (id === 'bite') back('cast', 'Missed it! Click as soon as the bobber plunges. Cast again.');
      } else if (e.k === 'early') {
        if (id === 'bite') back('cast', 'Too early: that reels you in. Wait for the plunge. Cast again.');
      } else if (e.k === 'catch') {
        if (id === 'reel') advance();
        else if (id === 'bubble' && bubbleLanded) advance();
      } else if (e.k === 'escape') {
        if (id === 'reel') back('cast', 'It got away! Keep the green bar on the fish. Cast again.');
        if (id === 'bubble') {
          bubbleLanded = false;
          paint('It got away. Cast into the bubbles again.');
        }
      }
    };
    paint();

    // ---- every frame: the steps you complete by doing, and Gus
    const off = onTick((dt) => {
      if (finished) return;
      const id = STEPS[step]!.id;
      const a = f.angler;
      aimMoved += Math.abs(a.aim - lastAim);
      lastAim = a.aim;
      if (id === 'aim' && aimMoved > 0.5) advance();
      else if (id === 'walk' && Math.abs(a.x - startX) >= 1.5) advance();
      // the bubble got used up before you landed in it: a fresh one
      if (id === 'bubble' && !bubbleLanded && !f.world.bubbles.length && a.phase === 'ready') putBubble();
      gusJolt = Math.max(0, gusJolt - dt);
      const t = f.world.t;
      const reeling = id === 'shove' || id === 'shoved';
      const gus: AnglerView = {
        x: GUS_X,
        phase: reeling ? 'reeling' : 'waiting',
        aim: -0.15,
        power: 0,
        bx: GUS_X - 2,
        bz: 15,
        bh: 0,
        dip: reeling ? 0 : Math.max(0, Math.sin(t * 1.7)) * 0.2,
        fish: reeling ? 'bluegill' : '',
        prog: 0.5 + 0.3 * Math.sin(t * 0.8),
        fy: 0.5 + 0.35 * Math.sin(t * 2.3),
        jolt: gusJolt > 0 ? 1 : 0,
      };
      f.remoteViews.set('gus', gus);
    });

    function end(toGuide: boolean): void {
      if (finished) return;
      finished = true;
      markSeen();
      if (toGuide) gearGuide(() => garage());
      else garage();
    }

    return () => {
      off();
      f.dispose();
    };
  });
}

// ------------------------------------------------------------------ the gear guide

export function gearGuide(onDone?: () => void): void {
  const p = session.profile;
  const orn = p.ornaments[0] ?? { type: 'hula' as const, tint: 0, tier: 'gold' as const };
  const pages: { pic: () => HTMLElement; title: string; lines: string[] }[] = [
    {
      pic: () => gearPic('surf', 120),
      title: 'Rod',
      lines: [
        'Your rod decides how far you can cast, and the big fish only bite far out. It also sets the size of your catch bar and how fast you reel.',
        `Example: the ${GEAR.surf!.name} reaches about 45 m; the Bamboo Pole you start with, about 27 m.`,
      ],
    },
    {
      pic: () => gearPic('crank', 120),
      title: 'Lure',
      lines: [
        'The tackle on the end of your line. Lures speed up bites, widen your catch bar, keep fish from slipping away, or draw a certain kind of fish.',
        `Example: the ${GEAR.crank!.name} attracts predators; the ${GEAR.cork!.name} makes your catch bar bigger.`,
      ],
    },
    {
      pic: () => gearPic('dough', 120),
      title: 'Bait',
      lines: [
        'Bait decides who comes to dinner. Each kind draws its own fish, and some make bites come faster.',
        `Example: ${GEAR.dough!.name} bring carp, ${GEAR.stink!.name} brings catfish, ${GEAR.corn!.name} finds rare fish.`,
      ],
    },
    {
      pic: () => ornPic(orn, 120),
      title: 'Dash ornament',
      lines: [
        'Rolled relics that ride on your truck’s dash. Each has 1–3 random perks (▲) with a value from a range; a strong perk always drags a curse (▼) along.',
        'Three are on your dash at a time and work at every hole. Buy them in the shop, find them in treasure chests, or get one from Her.',
      ],
    },
    {
      pic: () => charmIcon('last'),
      title: 'Run charm',
      lines: [
        'Bought in the shop on the road, they last until the run ends, like jokers. Three can be switched on at a hole.',
        `Example: ${CHARM.last!.name}: ${CHARM.last!.text}`,
      ],
    },
    {
      pic: () => h('div', { style: 'font-size:84px;line-height:1' }, '🎣'),
      title: 'Putting it together',
      lines: [
        'Gear you buy is yours for good. At every fishing hole you see its mission first, then pick a rod, a lure, a bait, your three ornaments and your charms to suit it.',
        'Gear that fits the mission is marked ✓. There’s no best set: the right kit changes every hole.',
      ],
    },
  ];
  let i = 0;
  const body = h('div.col', { style: 'gap:12px' });
  const paint = () => {
    const pg = pages[i]!;
    const pic = pg.pic();
    body.replaceChildren(
      h('div.row', h('span.chip', `${i + 1} / ${pages.length}`), h('div.grow'), h('button.tiny', { onclick: () => close() }, 'Close')),
      h('div.row', { style: 'gap:22px;align-items:center' }, h('div', { style: 'width:130px;display:flex;justify-content:center;flex:none' }, pic), h('div.col', { style: 'gap:8px' }, h('h2', pg.title), ...pg.lines.map((l) => h('div', { style: 'font-size:18px;line-height:1.4' }, l)))),
      h(
        'div.row',
        h('button', { disabled: i === 0, onclick: () => ((i = Math.max(0, i - 1)), audio.sfx('click'), paint()) }, '◀ Back'),
        h('div.grow'),
        i < pages.length - 1 ? h('button.primary', { onclick: () => ((i += 1), audio.sfx('click'), paint()) }, 'Next ▶') : h('button.primary', { onclick: () => close() }, 'Got it!'),
      ),
    );
  };
  paint();
  const close = modal(h('div', { style: 'width:760px' }, h('div.hud-label', 'Gear guide'), body), { wide: true, onClose: () => onDone?.() });
}
