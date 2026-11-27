// The leaderboard: you against your friends (this week's best run, best run ever, today's Daily Catch) and your own
// high scores (records, the ten best runs, the last ten). Friends' numbers come from their saves on Shoallhell's
// server (GET /api/sak/board); your own row is topped up from this device's save, which may be a moment ahead of it.
import { audio } from '../audio/audio';
import type { HistoryRow } from '../core/profile';
import { today, weekOf } from '../core/run';
import { FISH } from '../data/fish';
import { api, ApiError, type BoardRow, type BoardView } from '../net/api';
import { session } from '../session';
import { h, modal } from './dom';
import { friendsModal } from './friends';
import { pts } from './widgets';

export type Scope = 'week' | 'ever' | 'daily';
type Tab = 'friends' | 'mine';

const MEDAL = ['🥇', '🥈', '🥉'];
const SCOPES: [Scope, string][] = [
  ['week', 'This week'],
  ['ever', 'Best ever'],
  ['daily', 'Today’s Daily Catch'],
];

const modeName = (r: { mode: string; rank?: number; players?: number }): string =>
  r.mode === 'daily' ? 'Daily Catch' : r.mode === 'coop' ? `With friends${r.rank && r.players ? ` (#${r.rank} of ${r.players})` : ''}` : 'Solo';
const day = (at: number): string => new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fishName = (id: string): string => FISH[id]?.name ?? id;

// ------------------------------------------------------------------ the board

let cache: { at: number; view: BoardView } | null = null;

/** you and your friends, fetched at most every 20 seconds unless `fresh` */
export async function friendsBoard(fresh = false): Promise<BoardView> {
  const date = today();
  if (!fresh && cache && Date.now() - cache.at < 20_000 && cache.view.date === date) return withMe(cache.view);
  const view = await api.board(date);
  cache = { at: Date.now(), view };
  return withMe(view);
}

/** your row with this device's numbers, in case the save hasn't reached the server yet */
function withMe(view: BoardView): BoardView {
  const p = session.profile;
  const rows = view.rows.map((r) => {
    if (!r.me) return r;
    const top = p.top[0];
    const me: BoardRow = { ...r, best: Math.max(r.best, p.stats.best), runs: Math.max(r.runs, p.stats.runs), fish: Math.max(r.fish, p.stats.fish), marlene: Math.max(r.marlene, p.stats.marlene) };
    if (top && top.score >= me.best) me.top = { score: top.score, at: top.at, mode: top.mode, best: top.best ?? '' };
    if (p.week.start === view.week && p.week.best >= r.week) Object.assign(me, { week: p.week.best, weekRuns: Math.max(r.weekRuns, p.week.runs) });
    if (p.daily.date === view.date && p.daily.best > r.daily) me.daily = p.daily.best;
    return me;
  });
  return { ...view, rows };
}

/** what to say when the board can't be had (an older server answers 404) */
export function boardError(e: unknown): string {
  if (e instanceof ApiError && e.status === 404) return 'The friends board isn’t open on the server yet. Check back soon; your own scores are under “Your scores”.';
  return (e as Error).message;
}

const scoreOf = (r: BoardRow, s: Scope): number => (s === 'week' ? r.week : s === 'ever' ? r.best : r.daily);

export interface Placed {
  row: BoardRow;
  place: number;
  score: number;
}

/** best first; equal scores share a place; anyone without a score yet goes to the bottom */
export function ranked(rows: BoardRow[], s: Scope): Placed[] {
  const sorted = [...rows].sort((a, b) => scoreOf(b, s) - scoreOf(a, s) || (a.me ? -1 : b.me ? 1 : a.name.localeCompare(b.name)));
  let place = 0;
  let last = -1;
  return sorted.map((row, i) => {
    const score = scoreOf(row, s);
    if (score !== last) (place = i + 1), (last = score);
    return { row, place, score };
  });
}

/** one line on where you stand */
export function standing(list: Placed[], s: Scope): string {
  const when = s === 'week' ? 'this week' : s === 'daily' ? 'on today’s daily' : 'all time';
  const me = list.find((x) => x.row.me);
  const scored = list.filter((x) => x.score > 0);
  if (list.length < 2) return 'Just you so far. Add friends and race them for the top spot.';
  if (!scored.length) return s === 'week' ? 'Nobody has fished this week yet. First on the board wins the bragging rights.' : s === 'daily' ? 'Nobody has played today’s daily yet. Be first!' : 'No runs on the board yet.';
  if (!me || !me.score) {
    const lead = scored[0]!;
    return `${lead.row.name} leads ${when} with ${pts(lead.score)}. Your turn.`;
  }
  if (me.place === 1) {
    const next = list.find((x) => !x.row.me && x.score > 0 && x.score <= me.score);
    if (next && next.score === me.score) return `Tied for first ${when} with ${next.row.name}.`;
    return next ? `You’re on top ${when}, ${pts(me.score - next.score)} ahead of ${next.row.name}.` : `You’re on top ${when}. Nobody else has a score yet.`;
  }
  const ahead = [...list].reverse().find((x) => x.score > me.score)!;
  return `You’re #${me.place} of ${list.length} ${when}, ${pts(ahead.score - me.score)} behind ${ahead.row.name}.`;
}

function detail(r: BoardRow, s: Scope, score: number): string {
  if (s === 'week') return score ? `${r.weekRuns} run${r.weekRuns === 1 ? '' : 's'} this week` : 'Hasn’t fished this week';
  if (s === 'daily') return score ? r.dailyBest || 'Played today' : 'Hasn’t played today’s daily';
  if (!r.top) return score ? '' : 'No runs yet';
  return [modeName(r.top), day(r.top.at), r.top.best].filter(Boolean).join(' · ');
}

export function boardRow(x: Placed, s: Scope, compact = false): HTMLElement {
  const { row, place, score } = x;
  return h(
    'div.card.row',
    { style: `padding:${compact ? '5px 12px' : '8px 14px'};gap:12px;${row.me ? 'background:#fff3c8;' : ''}${score ? '' : 'opacity:.6;'}` },
    h('span', { style: `font-size:${compact ? 22 : 28}px;width:${compact ? 34 : 46}px;text-align:center;font-weight:800` }, score ? (MEDAL[place - 1] ?? `${place}.`) : '–'),
    h(
      'div.col.grow',
      { style: 'gap:0;min-width:0' },
      h('b', { style: `font-size:${compact ? 17 : 20}px` }, row.name, row.me ? h('span.chip', { style: 'margin-left:8px;font-size:12px;padding:1px 8px' }, 'you') : ''),
      h('span.small.dim', { style: 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, detail(row, s, score)),
    ),
    compact
      ? ''
      : h(
          'div.col',
          { style: 'gap:0;text-align:right;width:250px' },
          h('span.small', `${pts(row.fish)} fish · ${pts(row.runs)} run${row.runs === 1 ? '' : 's'}${row.marlene ? ` · 👑 Marlene ×${row.marlene}` : ''}`),
          h('span.small.dim', row.biggest ? `Biggest: ${Math.round(row.biggest.cm)} cm ${fishName(row.biggest.id)}` : ''),
        ),
    h('b.display', { style: `font-size:${compact ? 22 : 30}px;min-width:${compact ? 90 : 140}px;text-align:right` }, score ? pts(score) : '—'),
  );
}

function friendsTab(scope: Scope, setScope: (s: Scope) => void, close: () => void): HTMLElement {
  if (!session.online)
    return h(
      'div.card.col',
      { style: 'padding:24px;gap:10px;align-items:flex-start' },
      h('h3', 'Race your friends'),
      h('div', 'Sign in (Settings → Sign in) to see your friends’ best runs, this week’s board and today’s Daily Catch, and where you stand. Your own scores are under “Your scores”.'),
    );
  const scopes = h('div.tabs');
  const line = h('div', { style: 'font-weight:700;font-size:18px;min-height:24px' });
  const list = h('div.col.scroll', { style: 'gap:6px;max-height:440px;padding:2px 6px 8px 2px' }, h('div.dim', 'Loading the board…'));
  const foot = h('div.small.dim.grow');
  const draw = (s: Scope, view: BoardView | null) => {
    scopes.replaceChildren(...SCOPES.map(([k, label]) => h(`button.tiny${k === s ? '.on' : ''}`, { onclick: () => (audio.sfx('click'), setScope(k), draw(k, view)) }, label)));
    if (!view) return;
    const placed = ranked(view.rows, s);
    line.textContent = standing(placed, s);
    list.replaceChildren(...placed.map((x) => boardRow(x, s)));
    foot.textContent =
      s === 'week'
        ? `Week of ${day(Date.parse(`${view.week}T12:00:00`))}. A new week starts on Monday.`
        : s === 'daily'
          ? `Daily Catch for ${view.date}: same waters and twists for everyone, best score counts.`
          : 'Everyone’s best single run, solo, daily or with friends.';
  };
  draw(scope, null);
  friendsBoard()
    .then((v) => draw(scope, v))
    .catch((e) => list.replaceChildren(h('div.dim', boardError(e))));
  return h(
    'div.col',
    { style: 'gap:10px' },
    scopes,
    line,
    list,
    h('div.row', foot, h('button.tiny', { onclick: () => (close(), friendsModal()) }, '👥 Add friends')),
  );
}

// ------------------------------------------------------------------ your scores

function runRow(r: HistoryRow, place: number | null, mark: boolean): HTMLElement {
  return h(
    'div.card.row',
    { style: `padding:7px 14px;gap:12px;${mark ? 'background:#fff3c8' : ''}` },
    place === null ? h('b', { style: 'width:70px' }, day(r.at)) : h('span', { style: 'font-size:26px;width:44px;text-align:center;font-weight:800' }, MEDAL[place - 1] ?? `${place}.`),
    h(
      'div.col.grow',
      { style: 'gap:0;min-width:0' },
      h('b', modeName(r), place === null ? '' : h('span.dim', { style: 'font-weight:600' }, ` · ${day(r.at)}`), r.marlene ? ' 👑' : ''),
      h('span.small.dim', { style: 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, [r.holes.join(' → '), r.fish !== undefined ? `${r.fish} fish` : '', r.best ?? ''].filter(Boolean).join(' · ')),
    ),
    h('b.display', { style: 'font-size:26px;min-width:120px;text-align:right' }, pts(r.score)),
  );
}

function mineTab(): HTMLElement {
  const p = session.profile;
  const thisWeek = p.week.start === weekOf(today()) ? p.week.best : 0;
  let big: { id: string; cm: number } | null = null;
  for (const [id, e] of Object.entries(p.log)) if (e.best > (big?.cm ?? 0)) big = { id, cm: e.best };
  const cards: [string, string, string?][] = [
    ['Best run', pts(p.stats.best)],
    ['Best this week', thisWeek ? pts(thisWeek) : '—'],
    ['Best Daily Catch', p.stats.bestDaily ? pts(p.stats.bestDaily) : '—'],
    ['Best with friends', p.stats.bestCoop ? pts(p.stats.bestCoop) : '—'],
    ['Most fish in a run', pts(p.stats.mostFish)],
    ['Biggest fish', big ? `${Math.round(big.cm)} cm` : '—', big ? fishName(big.id) : undefined],
    ['Marlene landed', p.stats.marlene ? `${p.stats.marlene}×` : '—'],
    ['Runs', pts(p.stats.runs)],
    ['Fish caught', pts(p.stats.fish)],
    ['Points, all time', pts(p.stats.total)],
  ];
  const latest = p.history[0]?.at;
  const sub = h('div.tabs');
  const list = h('div.col.scroll', { style: 'gap:6px;max-height:300px;padding:2px 6px 8px 2px' });
  const draw = (which: 'top' | 'recent') => {
    sub.replaceChildren(
      h(`button.tiny${which === 'top' ? '.on' : ''}`, { onclick: () => (audio.sfx('click'), draw('top')) }, 'Top 10'),
      h(`button.tiny${which === 'recent' ? '.on' : ''}`, { onclick: () => (audio.sfx('click'), draw('recent')) }, 'Recent runs'),
    );
    const rows = which === 'top' ? p.top : p.history;
    list.replaceChildren(...(rows.length ? rows.map((r, i) => runRow(r, which === 'top' ? i + 1 : null, r.at === latest)) : [h('div.dim', 'No runs yet. Go fishing!')]));
  };
  draw('top');
  return h(
    'div.col',
    { style: 'gap:10px' },
    h(
      'div.grid',
      { style: 'grid-template-columns:repeat(5,1fr);gap:8px' },
      ...cards.map(([k, v, sub]) =>
        h(
          'div.card',
          { style: 'padding:8px 12px' },
          h('div.hud-label', { style: 'font-size:12px' }, k),
          h('div.display', { style: 'font-size:26px;white-space:nowrap' }, v),
          sub ? h('div.small.dim', { style: 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:-4px' }, sub) : '',
        ),
      ),
    ),
    h('div.row', h('h3.grow', 'Your high scores'), sub),
    list,
  );
}

// ------------------------------------------------------------------ the modal

export function leaderboard(tab: Tab = session.online ? 'friends' : 'mine', scope: Scope = 'week'): void {
  const tabs = h('div.tabs');
  const body = h('div.col', { style: 'gap:10px;min-height:540px' });
  const render = (t: Tab) => {
    tabs.replaceChildren(
      h(`button.tiny${t === 'friends' ? '.on' : ''}`, { onclick: () => (audio.sfx('click'), render('friends')) }, '👥 Friends'),
      h(`button.tiny${t === 'mine' ? '.on' : ''}`, { onclick: () => (audio.sfx('click'), render('mine')) }, '🎣 Your scores'),
    );
    body.replaceChildren(t === 'friends' ? friendsTab(scope, (s) => (scope = s), () => close()) : mineTab());
  };
  render(tab);
  const close = modal(h('div.col', { style: 'width:1000px' }, h('div.row', h('h2.grow', '🏆 Leaderboard'), tabs, h('button', { onclick: () => close() }, 'Close')), body), { wide: true });
}
