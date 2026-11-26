// Between holes: what you caught and whether the mission paid off. At the end: the run's score, the best catch,
// what you found, the ranking with friends, and the daily board.
import { show } from '../app';
import { audio } from '../audio/audio';
import type { Ornament } from '../core/ornament';
import { MISSION_BONUS } from '../core/mission';
import { QUALITY_NAME } from '../core/scoring';
import type { Catch, HoleResult } from '../core/types';
import { FISH } from '../data/fish';
import { setScene } from '../render/canvas';
import { DriveScene } from '../render/drive';
import { fishPic, ornPic } from '../render/pics';
import { ornamentById } from '../core/profile';
import { session } from '../session';
import { h } from './dom';
import type { Run } from './runner';
import { money, ornCard, pts } from './widgets';

function catchRow(c: Catch): HTMLElement {
  return h(
    'div.card.row',
    { style: 'padding:6px 12px;gap:10px' },
    fishPic(c.id, 80, 40),
    h('div.col.grow', { style: 'gap:0' }, h('b', FISH[c.id]?.name ?? c.id), h('span.small.dim', `${Math.round(c.cm)} cm${c.q ? ` · ${'★'.repeat(c.q)} ${QUALITY_NAME[c.q]}` : ''}${c.mission ? ' · mission' : ''}${c.firstEver ? ' · NEW' : ''}`)),
    h('b.display', { style: 'font-size:22px' }, `+${pts(c.points)}`),
  );
}

export function tallyScreen(run: Run, res: HoleResult): void {
  const hole = run.hole;
  audio.sfx(res.missionDone ? 'catch' : 'click');
  show((root) => {
    const top = [...res.catches].sort((a, b) => b.points - a.points).slice(0, 5);
    const timerText = h('b');
    const tick = window.setInterval(() => {
      if (!run.deadline) return;
      const s = Math.max(0, Math.ceil((run.deadline - Date.now()) / 1000));
      timerText.textContent = `${s}s`;
    }, 250);
    const board = h('div.col', { style: 'gap:4px' });
    const renderBoard = () =>
      board.replaceChildren(
        ...[...run.players]
          .sort((a, b) => b.score - a.score)
          .map((p, i) => h('div.row', { style: 'gap:8px;font-size:18px' }, h('b', `${i + 1}.`), h('span', { style: `width:14px;height:14px;border-radius:50%;border:2px solid var(--ink);background:${p.color}` }), h('span.grow', p.name), h('b', pts(p.score)))),
      );
    renderBoard();
    run.onPhase = renderBoard;
    root.appendChild(
      h(
        'div.screen',
        { style: 'align-items:center;justify-content:center;background:rgba(10,14,34,0.5)' },
        h(
          'div.panel.col',
          { style: 'width:760px;gap:12px;animation:pop .3s' },
          h('div.hud-label', `Hole ${hole.idx + 1} of 2 · ${hole.name}`),
          h('h2', { style: 'font-size:44px' }, res.catches.length ? `${res.catches.length} fish landed` : 'Skunked!'),
          h(
            'div.card.row',
            { style: `background:${res.missionDone ? '#c8f5cf' : '#f4e8d8'}` },
            h('span', { style: 'font-size:36px' }, res.missionDone ? '✅' : '❌'),
            h('div.col.grow', { style: 'gap:0' }, h('b', { style: 'font-size:20px' }, `${hole.mission.title}: ${res.catches.filter((c) => c.mission).length}/${hole.mission.goal}`), h('span', res.missionDone ? `Mission complete: the hole scores ×${MISSION_BONUS}!` : `${hole.mission.goalText} for ×${MISSION_BONUS}. So close.`)),
          ),
          top.length ? h('div.col', { style: 'gap:6px' }, ...top.map(catchRow)) : h('div.dim', 'Not a nibble. It happens to the best of us.'),
          h(
            'div.row',
            { style: 'justify-content:space-around' },
            h('div.center', h('div.hud-label', 'Fish'), h('div.display', { style: 'font-size:30px' }, pts(res.points))),
            h('div.center', h('div.hud-label', 'Mission'), h('div.display', { style: 'font-size:30px' }, res.missionDone ? `×${MISSION_BONUS}` : '—')),
            h('div.center', h('div.hud-label', 'Hole total'), h('div.display', { style: 'font-size:36px;color:#d8642a' }, pts(res.total))),
            h('div.center', h('div.hud-label', 'Treasure'), h('div.cash', { style: 'font-size:30px' }, money(res.treasureCash))),
          ),
          h('div.row', h('div.grow', h('div.hud-label', 'Run score'), h('div.display', { style: 'font-size:34px' }, pts(run.st.score))), h('div', h('div.hud-label', 'Cash to spend'), h('div.cash', { style: 'font-size:34px' }, money(run.st.cash)))),
          run.solo ? '' : board,
          run.solo ? h('button.primary.big', { onclick: () => (audio.sfx('click'), run.ready()) }, 'To the bait shop ▶') : h('div.row', h('span.grow', 'The truck leaves in ', timerText), h('button.primary', { onclick: () => run.ready(true) }, 'Ready')),
        ),
      ),
    );
    return () => {
      clearInterval(tick);
      run.onPhase = null;
    };
  });
}

export function resultsScreen(run: Run, o: { best?: Catch; dailyReward: Ornament | null; rank?: number }): void {
  const p = session.profile;
  const scene = new DriveScene(null, [{ name: 'You', color: '#ffcc33', ornaments: run.st.loadout.dash.map((id) => ornamentById(p, id) ?? null) }], 'Heading home. Nice day on the water.', 1e9);
  setScene(scene);
  audio.music('results');
  audio.ambience({ engine: true });
  audio.sfx('new');
  const pb = run.st.score >= p.stats.best && run.st.score > 0;
  const cfg = run.st.cfg;
  show((root) => {
    const score = h('div.display', { style: 'font-size:84px;line-height:1;color:#d8642a' }, '0');
    let shown = 0;
    const target = run.st.score;
    const iv = window.setInterval(() => {
      shown = Math.min(target, shown + Math.max(1, Math.ceil(target / 40)));
      score.textContent = pts(shown);
      if (shown >= target) clearInterval(iv);
    }, 30);
    const all = run.st.results.flatMap((r) => r?.catches ?? []);
    const newSpecies = all.filter((c) => c.firstEver).length;
    const found = run.st.found.map((id) => p.ornaments.find((x) => x.id === id)).filter(Boolean) as Ornament[];
    const ranking = run.solo
      ? ''
      : h(
          'div.col',
          { style: 'gap:6px' },
          h('h3', 'On the lake'),
          ...[...run.players]
            .sort((a, b) => b.score - a.score)
            .map((pl, i) =>
              h(
                'div.card.row',
                { style: `padding:8px 14px;${pl.id === run.me ? 'background:#fff3c8' : ''}` },
                h('span', { style: 'font-size:30px;width:44px' }, ['🥇', '🥈', '🥉', '4.'][i] ?? `${i + 1}.`),
                h('span', { style: `width:16px;height:16px;border-radius:50%;border:2px solid var(--ink);background:${pl.color}` }),
                h('b.grow', { style: 'font-size:20px' }, pl.name),
                h('b.display', { style: 'font-size:26px' }, pts(pl.id === run.me ? run.st.score : pl.score)),
              ),
            ),
        );
    const buttons =
      run.role === 'guest'
        ? h('div.row', h('span.grow.dim', 'Waiting for the host…'), h('button', { onclick: () => void import('./lobby').then((m) => m.leaveCoop()) }, 'Leave'))
        : run.role === 'host'
          ? h('div.row', h('div.grow'), h('button.primary.big', { onclick: () => void import('./lobby').then((m) => m.backToLobby()) }, 'Back to the lobby'))
          : h(
              'div.row',
              h('button', { onclick: () => run.leave() }, 'Garage'),
              h('div.grow'),
              cfg.mode === 'daily'
                ? h('button.gold.big', { onclick: () => void import('./runner').then((m) => (run.dispose(), m.startDaily())) }, 'Try the daily again')
                : h('button.primary.big', { onclick: () => void import('./runner').then((m) => (run.dispose(), m.startSolo())) }, 'Fish again'),
            );
    root.appendChild(
      h(
        'div.screen',
        { style: 'align-items:center;justify-content:flex-start;padding-top:28px' },
        h(
          'div.panel.col',
          { style: 'width:1040px;gap:12px;animation:pop .35s;max-height:560px' },
          h(
            'div.row',
            { style: 'align-items:flex-end' },
            h('div.col', { style: 'gap:0' }, h('div.hud-label', cfg.mode === 'daily' ? `Daily Catch · ${cfg.date}` : cfg.mode === 'coop' ? `With friends${o.rank ? ` · you finished #${o.rank}` : ''}` : 'Run complete'), score),
            pb ? h('span.chip.gold', { style: 'margin:0 0 14px 12px;font-size:18px;animation:pulse 1s infinite' }, '★ Personal best') : '',
            h('div.grow'),
            h('div.col', { style: 'gap:2px;text-align:right' }, ...cfg.holes.map((x, i) => h('div', `${x.name}: `, h('b', pts(run.st.results[i]?.total ?? 0)), run.st.results[i]?.missionDone ? ' ✅' : ''))),
          ),
          h(
            'div.row',
            { style: 'align-items:stretch;gap:14px;min-height:0' },
            h(
              'div.col.grow',
              { style: 'gap:8px' },
              o.best ? h('div', h('div.hud-label', 'Catch of the day'), catchRow(o.best)) : h('div.dim', 'No fish this run.'),
              h('div.row', { style: 'gap:10px' }, h('span.chip', `🐟 ${all.length} fish`), h('span.chip', `📖 ${newSpecies} new species`), h('span.chip', `💰 ${money(run.st.cash)} left unspent`)),
              found.length ? h('div', h('div.hud-label', 'Ornaments found'), h('div.row.wrap', { style: 'gap:6px' }, ...found.map((x) => ornPic(x, 64, { title: x.name })))) : '',
              o.dailyReward ? h('div', h('div.hud-label', 'Daily reward'), ornCard(o.dailyReward, { compact: true })) : '',
            ),
            ranking ? h('div', { style: 'width:420px' }, ranking) : '',
          ),
          buttons,
        ),
      ),
    );
    return () => clearInterval(iv);
  });
}
