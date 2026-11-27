// The garage: where every run starts and ends. Go fishing, play the daily, fish with friends; look over your tackle
// box, your glovebox of dash ornaments, your fish log, your angler and your records.
import { show, titleScreen } from '../app';
import { audio } from '../audio/audio';
import { GLOVEBOX_MAX, ornamentById } from '../core/profile';
import { loadoutStats, today } from '../core/run';
import type { Ornament } from '../core/ornament';
import { ALL_FISH, FISH, MOVES } from '../data/fish';
import { ALL_GEAR, BAITS, LURES, RODS, type Gear } from '../data/gear';
import { TIERS } from '../data/perks';
import { fishPic, gearPic, ornPic } from '../render/pics';
import { drawAngler, HATS, HAT_COLORS, HAIRS, JACKETS, SKINS } from '../render/anglerart';
import { api } from '../net/api';
import { saveSoon, session, signOut } from '../session';
import { demoLake, demoScene } from './demo';
import { h, modal, toast } from './dom';
import { friendsModal } from './friends';
import { coopHome, listenInvites } from './lobby';
import { forgetRun, resumeSolo, savedRun, startDaily, startSolo } from './runner';
import { warmUp } from './warm';
import { gearGuide, startTutorial, tutorialSeen } from './tutorial';
import { gearCard, money, ornCard, perkLines, pts, statSummary, tierBand } from './widgets';

export function garage(): void {
  audio.music('menu');
  audio.ambience({ water: true, birds: true });
  if (!demoScene()) demoLake({ seed: Math.floor(Math.random() * 1e6), look: session.profile.look });
  else demoScene()!.anglers[0]!.look = session.profile.look;
  if (session.online) listenInvites();
  warmUp();
  const saved = savedRun();
  // brand new: offer the tutorial once
  if (!saved && !tutorialSeen() && session.profile.stats.runs === 0)
    setTimeout(() => {
      const close = modal(
        h(
          'div.col',
          { style: 'width:540px;text-align:center;align-items:center' },
          h('h2', 'New to the water?'),
          h('div', { style: 'font-size:18px' }, 'A two-minute tutorial at a practice pond: casting, the bite, reeling, bubbles, shoving a rival, and what all your gear does.'),
          h('div.row', h('button', { onclick: () => (session.profile.tips.push('tutorial'), saveSoon(), close()) }, 'No thanks'), h('button.primary.big', { onclick: () => (close(), startTutorial()) }, 'Show me')),
        ),
      );
    }, 500);
  if (saved)
    setTimeout(() => {
      const close = modal(
        h(
          'div.col',
          { style: 'width:520px' },
          h('h2', 'Pick up where you left off?'),
          h('div', `Your ${saved.cfg.mode === 'daily' ? 'Daily Catch' : 'run'} is still going: hole ${saved.hole + 1} of ${saved.cfg.holes.length} (${saved.cfg.holes[saved.hole]?.name}), score ${pts(saved.score)}, ${money(saved.cash)} to spend.`),
          saved.phase === 'fish' ? h('div.small.dim', 'The hole you were fishing ends where you left it: you keep what you caught.') : '',
          h('div.row', h('button', { onclick: () => (forgetRun(), close()) }, 'Start fresh'), h('div.grow'), h('button.primary.big', { onclick: () => (close(), resumeSolo(saved)) }, 'Resume')),
        ),
        { locked: true },
      );
    }, 300);
  show((root) => {
    const p = session.profile;
    const ownedGear = ALL_GEAR.filter((g) => p.owned.includes(g.id)).length;
    const caught = ALL_FISH.filter((f) => p.log[f.id]).length;
    const d = today();
    const dailyBest = p.daily.date === d ? p.daily.best : 0;
    const big = (label: string, sub: string, cls: string, onclick: () => void, icon: string) =>
      h(
        `button.${cls}`,
        { style: 'display:flex;align-items:center;gap:16px;text-align:left;padding:16px 20px;border-radius:20px', onclick: () => (audio.sfx('click'), onclick()), onmouseenter: () => audio.sfx('hover') },
        h('span', { style: 'font-size:42px;line-height:1' }, icon),
        h('span.col', { style: 'gap:2px' }, h('span.display', { style: 'font-size:32px' }, label), h('span', { style: 'font-size:16px;font-weight:600;opacity:.92' }, sub)),
      );
    const small = (label: string, onclick: () => void) => h('button', { style: 'flex:1;font-size:18px', onclick: () => (audio.sfx('click'), onclick()) }, label);
    const dash = p.loadout.dash.map((id) => ornamentById(p, id));
    root.appendChild(
      h(
        'div.screen',
        { style: 'flex-direction:row;gap:28px;background:linear-gradient(90deg,rgba(10,14,34,0.78) 0%,rgba(10,14,34,0.55) 38%,rgba(10,14,34,0) 62%)' },
        h(
          'div.col',
          { style: 'width:520px;gap:14px' },
          h('div.logo', { style: 'font-size:64px' }, 'She’s A ', h('span.gold', 'Keeper')),
          h('div.tagline', { style: 'font-size:18px;margin-top:-6px' }, session.online ? `${session.user?.name}’s garage` : 'Your garage (offline)'),
          big('Go fishing', 'Three holes, two and a half minutes each. Shop on the road.', 'primary', () => startSolo(), '🎣'),
          big('Daily Catch', dailyBest ? `Today’s twist. Your best: ${pts(dailyBest)}` : 'Same lakes and twists for everyone today.', 'gold', () => dailyScreen(), '📅'),
          big('Fish with friends', session.online ? 'Up to four anglers on one lake.' : 'Sign in to fish with friends.', 'teal', () => (session.online ? coopHome() : toast('Sign in to fish with friends (Settings → Sign in).', 'bad')), '🚚'),
          h('div.row', small('🧰 Tackle', () => tackleBox()), small('🧸 Glovebox', () => glovebox()), small('📖 Fish log', () => fishLog())),
          h('div.row', small('🧢 Angler', () => anglerScreen()), small('🏆 Records', () => records()), small('⚙ Settings', () => settings())),
          h('div.row', small('🎓 Tutorial', () => startTutorial()), small('❓ How to play', () => howToPlay()), session.online ? small('👥 Friends', () => friendsModal()) : ''),
        ),
        h('div.grow'),
        h(
          'div.col',
          { style: 'width:400px;gap:14px;align-self:flex-end' },
          h(
            'div.panel',
            { style: 'padding:16px' },
            h('div.row', h('h3.grow', 'Your dash'), h('button.tiny', { onclick: () => glovebox() }, 'Change')),
            h('div.row', { style: 'justify-content:space-around;margin-top:6px' }, ...dash.map((o) => (o ? ornPic(o, 96, { title: o.name }) : h('div', { style: 'width:96px;height:96px;border:3px dashed var(--paper3);border-radius:16px' })))),
            h('div.small.dim', { style: 'margin-top:6px' }, `${p.ornaments.length}/${GLOVEBOX_MAX} ornaments in the glovebox`),
          ),
          h(
            'div.panel',
            { style: 'padding:16px' },
            h('div.row', { style: 'justify-content:space-between' }, h('span.dim', 'Gear collected'), h('b', `${ownedGear}/${ALL_GEAR.length}`)),
            h('div.row', { style: 'justify-content:space-between' }, h('span.dim', 'Species caught'), h('b', `${caught}/${ALL_FISH.length}`)),
            h('div.row', { style: 'justify-content:space-between' }, h('span.dim', 'Best run'), h('b', pts(p.stats.best))),
            h('div.row', { style: 'justify-content:space-between' }, h('span.dim', 'Marlene landed'), h('b', p.stats.marlene ? `${p.stats.marlene}×` : 'not yet…')),
          ),
        ),
      ),
    );
  });
}

// ------------------------------------------------------------------ how to play

export function howToPlay(): void {
  const sec = (icon: string, title: string, ...lines: string[]) =>
    h('div.card.row', { style: 'align-items:flex-start;gap:14px;padding:12px 16px' }, h('span', { style: 'font-size:34px;line-height:1' }, icon), h('div.col', { style: 'gap:2px' }, h('b', { style: 'font-size:20px' }, title), ...lines.map((l) => h('div', { style: 'font-size:16px' }, l))));
  const close = modal(
    h(
      'div.col',
      { style: 'width:1000px;gap:10px' },
      h('div.row', h('h2.grow', 'How to play'), h('button', { onclick: () => close() }, 'Got it')),
      h(
        'div.grid',
        { style: 'grid-template-columns:1fr 1fr;gap:10px' },
        sec('🎯', 'Aim and cast', 'Move the mouse to aim. Hold the button (or Space): the cast meter swings up and down. Let go to cast; the ring shows where it lands.', 'The very top of the meter is a Perfect Cast: farther, and better catches.'),
        sec('📏', 'Cast further, catch bigger', 'Most fish only bite far out: the dotted line shows metres from shore, and the fish log says how far each one lives. Your rod sets your reach.', 'Starter gear reaches the small fry. Half the fish need a really good rod; the giants need the longest cast there is.'),
        sec('🫧', 'Bubbles', 'Cast into a bubble spot and a fish bites in a second or two, and better fish live there. Dead centre is a Bullseye.', 'Each spot holds a few fish, then pops. With friends, it’s a race.'),
        sec('🚶', 'Walk the shore', 'A and D (or the arrow keys) walk you left and right along the shore for a better angle on a bubble.', 'With friends, each angler has their own stretch.'),
        sec('🤜', 'Shove (with friends)', 'Walk up to another angler and press E: their catch bar wobbles and their fish slips faster for a moment.', 'Some gear, charms and perks shove harder, further, faster, or shrug shoves off.'),
        sec('❗', 'The bite', 'Little dips are nibbles: wait. When the bobber plunges and a ! appears, click before the ring runs out.', 'Click too early and you reel in for nothing.'),
        sec('🟩', 'Reeling', 'Hold to lift the green bar, let go and it falls. Keep the fish inside: the meter on the right fills; outside it drains.', 'Every species moves its own way (Darter, Sinker, Runner, Wave…): the name shows under the reel.'),
        sec('📋', 'Missions', 'Every hole has one (Small Fry, Trophy Hunt, Most Wanted…). Matching fish score its multiplier; hit the goal for ×1.5 on the whole hole.', 'Gear that suits it is marked ✓ when you gear up.'),
        sec('🛒', 'The bait shop', 'Every point you catch is also a dollar this run. Buy gear (yours forever), dash ornaments, and run charms. Collecting all the gear takes a long while.', 'Rerolls are dear: $1,500, doubling each time. Cash doesn’t carry over: spend it on the way home.'),
        sec('🧸', 'Dash ornaments', 'Rolled relics with 1–3 perks. Strong rolls always bring a ▼ curse along. Three ride on your dash and apply at every hole.', 'Plastic, Brass, Silver, Gold, and Pearl (Hers).'),
        sec('👑', 'Marlene', 'She can show up at any hole: watch for a golden ripple. Cast into it for a chance she bites.', 'She is the hardest fish there is. Bring your biggest catch bar.'),
      ),
      h('div.small.dim', 'Esc or ⏸ pauses a solo run. Right-click (or Esc) takes back a cast you’re charging or waiting on. A/D walk, E shoves (with friends).'),
      h('div.row', h('div.grow'), h('button', { onclick: () => (close(), gearGuide()) }, '🧰 Gear guide'), h('button.primary', { onclick: () => (close(), startTutorial()) }, '🎓 Play the tutorial')),
    ),
    { wide: true },
  );
}

// ------------------------------------------------------------------ daily

export function dailyScreen(): void {
  void import('./runner').then((m) => m.dailyPreview());
}

// ------------------------------------------------------------------ tackle box

function tackleBox(tab: 'rod' | 'lure' | 'bait' = 'rod'): void {
  const p = session.profile;
  const body = h('div');
  const tabs = h('div.tabs');
  const render = (t: typeof tab) => {
    tabs.replaceChildren(
      ...(['rod', 'lure', 'bait'] as const).map((k) => h(`button.tiny${k === t ? '.on' : ''}`, { onclick: () => render(k) }, k === 'rod' ? 'Rods' : k === 'lure' ? 'Lures' : 'Bait')),
    );
    const list: Gear[] = t === 'rod' ? RODS : t === 'lure' ? LURES : BAITS;
    const detail = h('div', { style: 'width:420px' });
    const pick = (g: Gear) => detail.replaceChildren(gearCard(g.id, { owned: p.owned.includes(g.id) }), h('div.small.dim', { style: 'margin-top:8px' }, p.owned.includes(g.id) ? 'Yours. Pick it at any fishing hole.' : g.special ? '' : `Comes up in the shop during runs, for about $${g.price}.`));
    body.replaceChildren(
      h(
        'div.row',
        { style: 'align-items:flex-start;gap:18px' },
        h(
          'div.grid',
          { style: 'grid-template-columns:repeat(4,110px)' },
          ...list.map((g) => {
            const own = p.owned.includes(g.id);
            return h(`div.item${own ? '' : '.locked'}`, { onclick: () => pick(g) }, gearPic(g.id, 64), h('div.nm', g.name), h('div.small.dim', own ? 'Owned' : g.special ? 'Earned' : `$${g.price}`));
          }),
        ),
        detail,
      ),
    );
    pick(list.find((g) => p.owned.includes(g.id)) ?? list[0]!);
  };
  render(tab);
  const close = modal(h('div.col', { style: 'width:960px' }, h('div.row', h('h2.grow', 'Tackle Box'), tabs, h('button', { onclick: () => close() }, 'Close')), h('div.small.dim', 'Gear is bought in the shop during runs and kept forever. Every hole’s mission favours different gear.'), body), { wide: true });
}

// ------------------------------------------------------------------ glovebox

export function glovebox(onDone?: () => void): void {
  const p = session.profile;
  const body = h('div');
  let sel: Ornament | null = p.ornaments.find((o) => o.id === p.loadout.dash[0]) ?? p.ornaments[0] ?? null;
  let sort: 'new' | 'tier' = 'tier';
  const tierRank = { pearl: 5, gold: 4, silver: 3, brass: 2, plastic: 1 };
  const render = () => {
    const list = [...p.ornaments].sort((a, b) => (sort === 'tier' ? tierRank[b.tier] - tierRank[a.tier] || b.perks.length - a.perks.length : b.at - a.at));
    const slotOf = (id: string) => p.loadout.dash.indexOf(id);
    const detail = sel
      ? h(
          'div.col',
          { style: 'gap:10px' },
          ornCard(sel),
          h(
            'div.row.wrap',
            ...[0, 1, 2].map((i) =>
              h(
                `button.tiny${slotOf(sel!.id) === i ? '.teal' : ''}`,
                {
                  onclick: () => {
                    const from = slotOf(sel!.id);
                    if (from >= 0) p.loadout.dash[from] = p.loadout.dash[i] ?? null;
                    p.loadout.dash[i] = sel!.id;
                    audio.sfx('flick');
                    saveSoon();
                    render();
                  },
                },
                slotOf(sel!.id) === i ? `On dash ${i + 1}` : `Dash slot ${i + 1}`,
              ),
            ),
            slotOf(sel.id) >= 0 ? h('button.tiny', { onclick: () => ((p.loadout.dash[slotOf(sel!.id)] = null), saveSoon(), render()) }, 'Take off') : '',
            h('button.tiny', { onclick: () => ((sel!.fav = !sel!.fav), saveSoon(), render()) }, sel.fav ? '★ Kept' : '☆ Keep (no selling)'),
          ),
          h('div.small.dim', 'Sell ornaments you don’t need in the shop during a run.'),
        )
      : h('div.dim', 'Your glovebox is empty. Ornaments come from the shop, treasure chests and Her.');
    body.replaceChildren(
      h(
        'div.row',
        { style: 'align-items:flex-start;gap:18px' },
        h(
          'div.col',
          { style: 'gap:8px' },
          h('div.row', h('span.dim.small', `${p.ornaments.length}/${GLOVEBOX_MAX}`), h('div.grow'), h(`button.tiny${sort === 'tier' ? '.on' : ''}`, { onclick: () => ((sort = 'tier'), render()) }, 'Best first'), h(`button.tiny${sort === 'new' ? '.on' : ''}`, { onclick: () => ((sort = 'new'), render()) }, 'Newest')),
          h(
            'div.grid.scroll',
            { style: 'grid-template-columns:repeat(5,92px);max-height:600px;padding:8px 10px 10px 4px' },
            ...list.map((o) =>
              h(
                `div.item.tier-${o.tier}${sel?.id === o.id ? '.sel' : ''}`,
                { style: 'background:linear-gradient(180deg,#fff 60%,color-mix(in srgb,var(--tc) 45%,#fff));padding:6px', onclick: () => ((sel = o), audio.sfx('hover'), render()), title: o.name },
                ornPic(o, 64),
                h('div.small', { style: 'font-weight:700' }, `${'▲'.repeat(o.perks.length)}${o.perks.some((x) => x.c) ? ' ▼' : ''}`),
                slotOf(o.id) >= 0 ? h('div', { style: 'position:absolute;top:-8px;left:-6px', class: 'badge new' }, `#${slotOf(o.id) + 1}`) : '',
                o.fav ? h('div', { style: 'position:absolute;top:-8px;right:-6px', class: 'badge' }, '★') : '',
              ),
            ),
          ),
        ),
        h('div', { style: 'width:440px' }, detail),
      ),
    );
  };
  render();
  const close = modal(h('div.col', { style: 'width:1000px' }, h('div.row', h('h2.grow', 'Glovebox'), h('button', { onclick: () => close() }, 'Done')), h('div.small.dim', 'Three ornaments ride on your dash. Their perks apply at every hole; ▼ curses come along with strong perks.'), body), { wide: true, onClose: onDone });
}

// ------------------------------------------------------------------ fish log

function fishLog(): void {
  const p = session.profile;
  const detail = h('div', { style: 'width:360px' });
  const pick = (id: string) => {
    const f = FISH[id]!;
    const e = p.log[id];
    detail.replaceChildren(
      h(
        'div.card.col',
        { style: 'gap:6px;align-items:center;text-align:center' },
        fishPic(id, 300, 150, !e),
        h('b', { style: 'font-size:24px' }, e ? f.name : '???'),
        e ? h('div', f.blurb) : h('div.dim', 'Not caught yet.'),
        h('div.small.dim', `${f.biomes.length > 4 ? 'Every water' : f.biomes.join(', ')}${f.times ? ` · ${f.times.join(', ')}` : ''}`),
        h('div.small.dim', `${f.cm[0]}–${f.cm[1]} cm · base ${f.pts} pts · difficulty ${f.diff}`),
        h('div.small', { style: 'font-weight:700' }, f.id === 'marlene' ? 'Bites in her golden ripple' : f.dist ? `Bites ${f.dist} m or more out` : 'Bites right by the shore', ` · ${MOVES[f.beh].name}: ${MOVES[f.beh].text}`),
        e ? h('div', h('b', `${e.n} caught`), ` · best ${Math.round(e.best)} cm (${e.bestKg} kg)`) : '',
      ),
    );
  };
  const caught = ALL_FISH.filter((f) => p.log[f.id]).length;
  const close = modal(
    h(
      'div.col',
      { style: 'width:1180px' },
      h('div.row', h('h2.grow', `Fish Log  ${caught}/${ALL_FISH.length}`), h('button', { onclick: () => close() }, 'Close')),
      h(
        'div.row',
        { style: 'align-items:flex-start;gap:16px' },
        h(
          'div.grid.scroll',
          { style: 'grid-template-columns:repeat(6,120px);max-height:640px;padding:6px 10px 10px 4px' },
          ...ALL_FISH.map((f) => {
            const e = p.log[f.id];
            return h('div.item', { onclick: () => pick(f.id), style: f.id === 'marlene' ? 'background:#fff3c8' : '' }, fishPic(f.id, 104, 52, !e), h('div.nm', { style: 'font-size:13px' }, e ? f.name : '???'), e ? h('div.small.dim', `${Math.round(e.best)} cm`) : '');
          }),
        ),
        detail,
      ),
    ),
    { wide: true },
  );
  pick(ALL_FISH.find((f) => p.log[f.id])?.id ?? 'minnow');
}

// ------------------------------------------------------------------ angler look

function anglerScreen(): void {
  const p = session.profile;
  const cv = h('canvas', { width: '360', height: '420', style: 'width:180px;height:210px;background:linear-gradient(#8ac8f0,#4a90c0);border:3px solid var(--ink);border-radius:16px' }) as HTMLCanvasElement;
  const draw = () => {
    const c = cv.getContext('2d')!;
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.clearRect(0, 0, 180, 210);
    c.save();
    c.translate(90, 200);
    c.scale(0.95, 0.95);
    drawAngler(c, p.look, { pose: 'idle', aim: 0, power: 0, pt: 0, now: 0, fy: 0.5 });
    c.restore();
  };
  const row = (label: string, n: number, cur: () => number, set: (v: number) => void, swatch?: string[], names?: string[]) => {
    const box = h('div.row.wrap', { style: 'gap:6px' });
    const paint = () =>
      box.replaceChildren(
        ...Array.from({ length: n }, (_, i) =>
          h(
            `button.tiny${cur() === i ? '.on' : ''}`,
            { style: `${swatch ? `background:${swatch[i]};width:40px;height:40px;` : ''}${cur() === i ? 'outline:4px solid var(--orange)' : ''}`, onclick: () => (set(i), audio.sfx('click'), saveSoon(), draw(), paint(), demoScene() && (demoScene()!.anglers[0]!.look = p.look)) },
            names ? names[i]! : '',
          ),
        ),
      );
    paint();
    return h('div.col', { style: 'gap:4px' }, h('b', label), box);
  };
  const close = modal(
    h(
      'div.col',
      { style: 'width:820px' },
      h('div.row', h('h2.grow', 'Your angler'), h('button', { onclick: () => close() }, 'Done')),
      h(
        'div.row',
        { style: 'align-items:flex-start;gap:20px' },
        cv,
        h(
          'div.col.grow',
          row('Hat', HATS.length, () => p.look.hat, (v) => (p.look.hat = v), undefined, HATS),
          row('Hat colour', HAT_COLORS.length, () => p.look.hatColor, (v) => (p.look.hatColor = v), HAT_COLORS),
          row('Vest', JACKETS.length, () => p.look.jacket, (v) => (p.look.jacket = v), JACKETS),
          row('Skin', SKINS.length, () => p.look.skin, (v) => (p.look.skin = v), SKINS),
          row('Hair', HAIRS.length, () => p.look.hair, (v) => (p.look.hair = v), HAIRS),
        ),
      ),
    ),
    { wide: true },
  );
  draw();
}

// ------------------------------------------------------------------ records

function records(): void {
  const p = session.profile;
  const close = modal(
    h(
      'div.col',
      { style: 'width:760px' },
      h('div.row', h('h2.grow', 'Records'), h('button', { onclick: () => close() }, 'Close')),
      h(
        'div.row.wrap',
        { style: 'gap:10px' },
        ...[
          ['Runs', pts(p.stats.runs)],
          ['Best run', pts(p.stats.best)],
          ['Fish caught', pts(p.stats.fish)],
          ['Points, all time', pts(p.stats.total)],
          ['Dailies played', pts(p.stats.dailies)],
          ['Marlene landed', pts(p.stats.marlene)],
        ].map(([k, v]) => h('div.card', { style: 'min-width:220px' }, h('div.hud-label', k!), h('div.display', { style: 'font-size:32px' }, v!))),
      ),
      h('h3', 'Recent runs'),
      p.history.length
        ? h(
            'div.col',
            { style: 'gap:6px' },
            ...p.history.map((r) =>
              h(
                'div.card.row',
                { style: 'padding:8px 12px' },
                h('b', { style: 'width:110px' }, new Date(r.at).toLocaleDateString()),
                h('span', { style: 'width:120px' }, r.mode === 'daily' ? 'Daily' : r.mode === 'coop' ? `With friends${r.rank ? ` (#${r.rank}/${r.players})` : ''}` : 'Solo'),
                h('span.grow.small.dim', r.holes.join(' → ')),
                h('b.display', { style: 'font-size:22px' }, pts(r.score)),
              ),
            ),
          )
        : h('div.dim', 'No runs yet. Go fishing!'),
    ),
    { wide: true },
  );
}

// ------------------------------------------------------------------ settings

function settings(): void {
  const p = session.profile;
  const slider = (label: string, v: number, set: (x: number) => void) => {
    const inp = h('input', { type: 'range', min: '0', max: '100', value: String(Math.round(v * 100)), style: 'flex:1;padding:0' }) as HTMLInputElement;
    inp.addEventListener('input', () => {
      set(Number(inp.value) / 100);
      audio.setVolumes(p.settings.sfx, p.settings.music);
    });
    inp.addEventListener('change', () => (audio.sfx('click'), saveSoon()));
    return h('div.row', h('b', { style: 'width:120px' }, label), inp);
  };
  const toggle = (label: string, get: () => boolean, set: (v: boolean) => void) => {
    const b = h('button.tiny', {}, get() ? 'On' : 'Off');
    b.addEventListener('click', () => {
      set(!get());
      b.textContent = get() ? 'On' : 'Off';
      saveSoon();
    });
    return h('div.row', h('b', { style: 'width:220px' }, label), b);
  };
  const name = h('input', { type: 'text', maxlength: '20', value: session.user?.name ?? '', style: 'flex:1' }) as HTMLInputElement;
  const close = modal(
    h(
      'div.col',
      { style: 'width:620px' },
      h('div.row', h('h2.grow', 'Settings'), h('button', { onclick: () => close() }, 'Done')),
      slider('Sound', p.settings.sfx, (x) => (p.settings.sfx = x)),
      slider('Music', p.settings.music, (x) => (p.settings.music = x)),
      toggle('Screen shake', () => p.settings.shake, (v) => (p.settings.shake = v)),
      toggle('Tips while fishing', () => p.settings.hints, (v) => {
        p.settings.hints = v;
        if (v) p.tips = [];
      }),
      h('hr', { style: 'border:none;border-top:3px dashed var(--paper3);width:100%' }),
      session.online
        ? h(
            'div.col',
            h('div.row', h('b', { style: 'width:120px' }, 'Name'), name, h('button.tiny', { onclick: async () => {
              try {
                const r = await api.rename(name.value.trim());
                session.user = r.user;
                toast('Name changed.');
              } catch (e) {
                toast((e as Error).message, 'bad');
              }
            } }, 'Save')),
            h('div.row', h('span.dim.grow', `Signed in as ${session.user?.email}`), h('button.red', { onclick: async () => (close(), await signOut(), titleScreen(false)) }, 'Sign out')),
          )
        : h('div.row', h('span.dim.grow', 'Playing offline. Sign in to save to your account and fish with friends.'), h('button.teal', { onclick: () => (close(), void import('../app').then((m) => m.authScreen())) }, 'Sign in')),
    ),
  );
}

export { money, statSummary, loadoutStats, perkLines, tierBand, TIERS };
export { startDaily };
