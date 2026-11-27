// At the fishing hole, before the clock starts: the mission is known, so pick the gear for it. Rod, lure, bait, the
// three ornaments on your dash and up to three run charms. Gear that suits the mission is marked ✓. In co-op there's a
// 90-second timer and everyone can ready up early.
import { show } from '../app';
import { audio } from '../audio/audio';
import { holePool } from '../core/fishpool';
import { ornamentById } from '../core/profile';
import { HoleWorld } from '../core/world';
import { CHARM, CHARM_SLOTS, MOD } from '../data/charms';
import { GEAR, KIND_NAME, type GearKind } from '../data/gear';
import { BIOMES, TIME_ICON, TIME_NAMES, WEATHER_ICON, WEATHER_NAMES } from '../data/spots';
import { describeBonus } from '../core/stats';
import { onTick, setScene } from '../render/canvas';
import { fishPic, gearPic, ornPic } from '../render/pics';
import { LakeScene } from '../render/lake';
import { saveSoon, session } from '../session';
import { h, modal } from './dom';
import type { Run } from './runner';
import { charmIcon, ornCard, statSummary } from './widgets';

export function loadoutScreen(run: Run): void {
  const hole = run.hole;
  const scene = new LakeScene(hole);
  const world = new HoleWorld({ ...hole, legendAt: 1e9 }, run.st.cfg.mods);
  scene.world = world;
  scene.anglers = run.seats().map((s) => ({ id: s.id, name: s.name, look: s.look, view: { x: s.x, phase: 'ready', aim: 0, power: 0, bx: s.x, bz: 0, bh: 0, dip: 0, fish: '', prog: 0, fy: 0.5 }, local: s.id === run.me, color: s.color, pt: 0, lastPhase: '', shownCm: 0, lure: s.lure }));
  setScene(scene);
  audio.music(hole.time === 'night' || hole.time === 'dusk' ? 'night' : 'fish');
  audio.ambience({ water: true, birds: hole.time === 'day' || hole.time === 'dawn', crickets: hole.time === 'night' });
  const p = session.profile;
  const lo = run.st.loadout;
  const mission = hole.mission;
  const pool = holePool(hole.biome, hole.time).filter((s) => !s.tags.includes('junk'));
  show((root) => {
    const body = h('div', { style: 'display:contents' });
    const timer = h('div.timerbar', { style: 'width:100%' }, h('i'));
    const timerText = h('b', '');
    const players = h('div.col', { style: 'gap:4px' });
    const off = onTick((dt) => {
      world.update(dt);
      if (run.deadline) {
        const left = Math.max(0, run.deadline - Date.now());
        (timer.firstChild as HTMLElement).style.width = `${(left / 90000) * 100}%`;
        const s = Math.ceil(left / 1000);
        if (timerText.textContent !== `${s}s`) timerText.textContent = `${s}s`;
      }
    });
    const gearRow = (kind: GearKind) => {
      const owned = p.owned.filter((id) => GEAR[id]?.kind === kind);
      const cur = lo[kind];
      return h(
        'div.col',
        { style: 'gap:6px' },
        h('div.row', h('b', { style: 'font-size:20px' }, KIND_NAME[kind]), h('span.small.dim.grow', describeBonus(GEAR[cur]?.bonus).join(' · ') || 'No bonuses')),
        h(
          'div.row.scroll',
          { style: 'gap:10px;overflow-x:auto;padding:10px 4px 12px' },
          ...owned.map((id) =>
            h(
              `div.item${id === cur ? '.sel' : ''}${mission.fits.includes(id) ? '.fits' : ''}`,
              { style: 'width:104px;flex:none', title: `${GEAR[id]!.name}: ${describeBonus(GEAR[id]!.bonus).join(', ') || 'no bonuses'}`, onclick: () => ((lo[kind] = id), (p.loadout[kind] = id), saveSoon(), audio.sfx('click'), render()) },
              gearPic(id, 56),
              h('div.nm', { style: 'font-size:13px' }, GEAR[id]!.name),
            ),
          ),
        ),
      );
    };
    const render = () => {
      const stats = run.stats();
      const dash = lo.dash.map((id) => ornamentById(p, id));
      const me = run.myPlayer();
      const fitsCount = [lo.rod, lo.lure, lo.bait].filter((id) => mission.fits.includes(id)).length;
      players.replaceChildren(
        ...(run.solo
          ? []
          : run.players.map((pl) => h('div.row', { style: 'gap:8px' }, h('span', { style: `width:14px;height:14px;border-radius:50%;border:2px solid var(--ink);background:${pl.color}` }), h('span.grow', pl.name, pl.online ? '' : ' (away)'), h('b', { style: `color:${pl.ready ? '#2a9a4a' : '#8a7a6a'}` }, pl.ready ? '✓ ready' : '…')))),
      );
      body.replaceChildren(
        // the mission
        h(
          'div.panel.col',
          { style: 'width:400px;gap:10px;padding:18px' },
          h('div.hud-label', `Hole ${hole.idx + 1} of ${run.st.cfg.holes.length} · ${BIOMES[hole.biome].name}`),
          h('h2', { style: 'font-size:34px;line-height:1' }, hole.name),
          h('div.row.wrap', { style: 'gap:6px' }, h('span.chip', `${TIME_ICON[hole.time]} ${TIME_NAMES[hole.time]}`), h('span.chip', `${WEATHER_ICON[hole.weather]} ${WEATHER_NAMES[hole.weather]}`), h('span.chip', `⏱ ${+(hole.seconds / 60).toFixed(1)} min`)),
          h('div.card', { style: 'background:#fff7e0' }, h('div.display', { style: 'font-size:28px;color:#d8642a' }, mission.title), h('div', { style: 'font-weight:700;font-size:18px' }, mission.text), h('div', `Goal: ${mission.goalText} → the whole hole scores ×1.5`), h('div.small.dim', { style: 'margin-top:4px' }, `💡 ${mission.hint}`)),
          run.st.cfg.mods.length ? h('div.col', { style: 'gap:4px' }, ...run.st.cfg.mods.map((m) => h('div.small', h('b', `${MOD[m]!.glyph} ${MOD[m]!.name}: `), MOD[m]!.text))) : '',
          h('b', 'Living here'),
          h('div.row.wrap', { style: 'gap:4px' }, ...pool.map((s) => fishPic(s.id, 76, 38, !p.log[s.id], { title: p.log[s.id] ? `${s.name} (${s.cm[0]}–${s.cm[1]} cm)` : 'Not caught yet', style: 'background:rgba(255,255,255,0.6);border-radius:8px' }))),
        ),
        // gear
        h(
          'div.panel.col',
          { style: 'width:660px;gap:6px;padding:18px' },
          h('div.row', h('h2.grow', { style: 'font-size:32px' }, 'Pick your gear'), h('span.chip.good', `${fitsCount} piece${fitsCount === 1 ? '' : 's'} fit the mission`)),
          gearRow('rod'),
          gearRow('lure'),
          gearRow('bait'),
          h('div.small.dim', 'New gear comes from the shop on the road. Everything you buy is yours for good.'),
        ),
        // dash, charms, stats, go
        h(
          'div.panel.col',
          { style: 'width:400px;gap:10px;padding:18px' },
          h('div.row', h('b.grow', { style: 'font-size:20px' }, 'Dash ornaments'), h('span.small.dim', 'click to swap')),
          h(
            'div.row',
            { style: 'justify-content:space-between' },
            ...[0, 1, 2].map((i) => {
              const o = dash[i];
              return h(
                'div.item',
                { style: 'width:108px;height:120px;padding:4px', title: o?.name ?? 'Empty', onclick: () => pickOrnament(run, i, render) },
                o ? ornPic(o, 84) : h('div', { style: 'width:84px;height:84px;display:flex;align-items:center;justify-content:center;font-size:40px;color:#ccc' }, '+'),
                h('div.small', { style: 'font-weight:700' }, o ? `${'▲'.repeat(o.perks.length)}${o.perks.some((x) => x.c) ? '▼' : ''}` : 'empty'),
              );
            }),
          ),
          h('div.row', h('b.grow', { style: 'font-size:20px' }, `Run charms (${lo.charms.length}/${CHARM_SLOTS})`)),
          run.st.charms.length
            ? h(
                'div.row.wrap',
                { style: 'gap:8px' },
                ...run.st.charms.map((id) => {
                  const on = lo.charms.includes(id);
                  const el = charmIcon(id, true);
                  el.style.opacity = on ? '1' : '0.35';
                  el.style.cursor = 'pointer';
                  el.addEventListener('click', () => {
                    if (on) lo.charms = lo.charms.filter((c) => c !== id);
                    else if (lo.charms.length < CHARM_SLOTS) lo.charms.push(id);
                    audio.sfx('click');
                    render();
                  });
                  return el;
                }),
              )
            : h('div.small.dim', 'Buy charms in the shop on the road; they last the run.'),
          lo.charms.length ? h('div.col', { style: 'gap:2px' }, ...lo.charms.map((c) => h('div.small', h('b', `${CHARM[c]!.name}: `), CHARM[c]!.text))) : '',
          h('hr', { style: 'border:none;border-top:3px dashed var(--paper3);width:100%;margin:2px 0' }),
          statSummary(stats),
          h('div.grow'),
          run.solo
            ? h('button.primary.big', { onclick: () => (audio.sfx('whistle'), run.ready()) }, 'Start fishing!')
            : h('div.col', { style: 'gap:6px' }, h('div.row', h('span.grow.small', 'Starts when everyone is ready'), timerText), timer, players, h(`button.${me?.ready ? 'teal' : 'primary'}.big`, { onclick: () => run.ready(!me?.ready) }, me?.ready ? '✓ Ready (click to change)' : 'Ready!')),
        ),
      );
    };
    render();
    run.onPhase = () => render();
    root.appendChild(h('div.screen', { style: 'flex-direction:row;align-items:flex-end;gap:20px;padding:28px 34px;background:linear-gradient(180deg,rgba(10,14,34,0) 0%,rgba(10,14,34,0.45) 55%)' }, body));
    return () => {
      off();
      run.onPhase = null;
    };
  });
}

function pickOrnament(run: Run, slot: number, done: () => void): void {
  const p = session.profile;
  const lo = run.st.loadout;
  const list = [...p.ornaments].sort((a, b) => b.perks.length - a.perks.length || b.at - a.at);
  const close = modal(
    h(
      'div.col',
      { style: 'width:1040px' },
      h('div.row', h('h2.grow', `Dash slot ${slot + 1}`), lo.dash[slot] ? h('button', { onclick: () => ((lo.dash[slot] = null), (p.loadout.dash = [...lo.dash]), saveSoon(), close(), done()) }, 'Empty this slot') : '', h('button', { onclick: () => close() }, 'Cancel')),
      h(
        'div.grid.scroll',
        { style: 'grid-template-columns:repeat(2,1fr);max-height:660px;padding:4px 10px 10px 4px' },
        ...list.map((o) => {
          const at = lo.dash.indexOf(o.id);
          const card = ornCard(o, { compact: true, extra: at >= 0 ? [h('span.chip.good', `On dash slot ${at + 1}`)] : [] });
          card.style.cursor = 'pointer';
          card.addEventListener('click', () => {
            if (at >= 0) lo.dash[at] = lo.dash[slot] ?? null;
            lo.dash[slot] = o.id;
            p.loadout.dash = [...lo.dash];
            saveSoon();
            audio.sfx('flick');
            close();
            done();
            run.sendStatus(true);
          });
          return card;
        }),
      ),
    ),
    { wide: true },
  );
}
