// A run from start to finish: drive → gear up for the mission → fish → tally → shop → drive → gear up → fish → tally
// → shop on the way home → results. Solo (and the daily) it runs here on its own. In co-op the host decides when each
// phase starts and ends (timers, everyone ready) and runs the shared lake; every player fishes, shops and saves their
// own things on their own machine.
import { show } from '../app';
import { audio } from '../audio/audio';
import type { AEvent, Angler, AnglerView } from '../core/angler';
import { rollOrnament, type Ornament } from '../core/ornament';
import { GLOVEBOX_MAX, logCatch, newOrnamentId, ornamentById, recordRun, type HistoryRow } from '../core/profile';
import { Rng } from '../core/rng';
import { buildRun, dailyRun, holeResult, loadoutStats, newRunState, nextPhase, today, weekOf, type RunPhase, type RunState } from '../core/run';
import { derived } from '../core/stats';
import type { AnglerLook, Catch, HoleResult, RunConfig } from '../core/types';
import type { WorldSnap } from '../core/world';
import { CHARM, CHARMS, CHARM_SLOTS, MOD } from '../data/charms';
import { FISH } from '../data/fish';
import { BIOMES, TIME_ICON, TIME_NAMES, WEATHER_ICON, WEATHER_NAMES } from '../data/spots';
import { api } from '../net/api';
import type { CoopLink } from '../net/coop';
import { setScene } from '../render/canvas';
import { DriveScene, type DashSection } from '../render/drive';
import { LakeScene } from '../render/lake';
import { gameCanvas } from '../render/canvas';
import { displayName, saveNow, saveSoon, session } from '../session';
import { stopDemo } from './demo';
import { h, modal, toast } from './dom';
import { FishingSession, SEAT_COLORS, seatXs, type SeatInfo } from './fishing';
import { garage } from './garage';
import { loadoutScreen } from './loadout';
import { resultsScreen, tallyScreen } from './results';
import { shopScreen } from './shop';
import { stageScale } from './stage';
import { ornCard, pts } from './widgets';

export interface CoopPlayer {
  id: string;
  name: string;
  look: AnglerLook;
  color: string;
  slot: number;
  dash: Ornament[];
  lure: string;
  score: number;
  ready: boolean;
  done: boolean;
  online: boolean;
  legend: number;
  bubbleRate: number;
  /** left the run (refreshed their page): no longer waited for */
  gone?: boolean;
}

export const PHASE_SECONDS: Partial<Record<RunPhase, number>> = { drive: 9, loadout: 90, tally: 10, shop: 75 };

export class Run {
  st: RunState;
  role: 'solo' | 'host' | 'guest';
  me: string;
  players: CoopPlayer[] = [];
  link: CoopLink | null;
  fishing: FishingSession | null = null;
  deadline = 0;
  private treasureCash = 0;
  private catchesThisHole: Catch[] = [];
  private views = new Map<string, AnglerView>();
  private offs: (() => void)[] = [];
  private hostTimer = 0;
  private sentScore = -1;
  private finished = false;
  onPhase: (() => void) | null = null;
  /** the run's score after each hole, for the results */
  holeTotals: number[] = [];

  constructor(cfg: RunConfig, role: Run['role'], me: string, link: CoopLink | null, players: CoopPlayer[]) {
    const p = session.profile;
    // development only: ?holesec=30 makes every hole that many seconds (testing)
    const short = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('holesec')) : 0;
    if (short > 0) cfg = { ...cfg, holes: cfg.holes.map((x) => ({ ...x, seconds: short, legendAt: Math.min(x.legendAt, short * 0.3) })) };
    const lo = { ...p.loadout, dash: [...p.loadout.dash], charms: [] };
    const start = loadoutStats(lo, p.ornaments, cfg.mods).startCash;
    this.st = newRunState(cfg, lo, start);
    this.role = role;
    this.me = me;
    this.link = link;
    this.players = players;
    if (link) {
      this.offs.push(link.on((msg, from) => this.onMsg(msg, from)));
      this.hostTimer = window.setInterval(() => this.hostTick(), 200);
    }
  }

  get solo(): boolean {
    return this.role === 'solo';
  }
  get hole() {
    return this.st.cfg.holes[this.st.hole]!;
  }
  myPlayer(): CoopPlayer | undefined {
    return this.players.find((p) => p.id === this.me);
  }

  dispose(): void {
    this.fishing?.dispose();
    this.fishing = null;
    for (const f of this.offs) f();
    this.offs = [];
    clearInterval(this.hostTimer);
    if (current === this) current = null;
  }

  // ------------------------------------------------------------------ phases

  start(): void {
    stopDemo();
    this.enter('drive');
  }

  /** move on (solo, or the host deciding for everyone) */
  next(): void {
    if (this.role === 'guest') return;
    const n = nextPhase(this.st);
    this.st.hole = n.hole;
    this.st.shopVisit = n.shopVisit;
    this.enter(n.phase);
    if (this.role === 'host') this.link!.send({ t: 'phase', phase: n.phase, hole: n.hole, ms: this.deadline ? this.deadline - Date.now() : 0 });
  }

  enter(phase: RunPhase, ms?: number): void {
    if (this.finished) return;
    const prev = this.st.phase;
    if (prev === 'fish' && phase !== 'fish') this.endHole();
    this.st.phase = phase;
    this.overAt = 0;
    this.fishing?.dispose();
    this.fishing = null;
    // "done" only means something during a hole: a late message from the last hole must not count for the next one
    for (const p of this.players) {
      p.ready = false;
      p.done = false;
    }
    if (phase === 'drive' || phase === 'results') delete this.st.shop;
    const secs = PHASE_SECONDS[phase];
    this.deadline = !this.solo && secs ? Date.now() + (ms ?? secs * 1000) : this.solo && phase === 'drive' ? Date.now() + secs! * 1000 : 0;
    if (this.solo) keepRun(phase === 'results' ? null : this.st);
    if (phase === 'drive') this.driveScreen();
    else if (phase === 'loadout') loadoutScreen(this);
    else if (phase === 'fish') this.fishScreen();
    else if (phase === 'tally') tallyScreen(this, this.st.results[this.st.results.length - 1]!);
    else if (phase === 'shop') shopScreen(this);
    else if (phase === 'results') this.finish();
    this.sendStatus(true);
    this.onPhase?.();
  }

  /** the local player is ready to move on (solo: move on now) */
  ready(on = true): void {
    if (this.solo) return this.next();
    const me = this.myPlayer();
    if (me) me.ready = on;
    audio.sfx('ready');
    this.sendStatus(true);
    this.onPhase?.();
  }

  // ------------------------------------------------------------------ drive

  private dashSections(): DashSection[] {
    const p = session.profile;
    if (this.solo) return [{ name: displayName(), color: SEAT_COLORS[0]!, ornaments: this.st.loadout.dash.map((id) => ornamentById(p, id) ?? null) }];
    return [...this.players].sort((a, b) => a.slot - b.slot).map((pl) => ({ name: pl.name, color: pl.color, ornaments: pl.id === this.me ? this.st.loadout.dash.map((id) => ornamentById(p, id) ?? null) : [0, 1, 2].map((i) => pl.dash[i] ?? null) }));
  }

  private driveScreen(): void {
    const hole = this.hole;
    const radio = `${hole.name}, ${TIME_NAMES[hole.time].toLowerCase()}, ${WEATHER_NAMES[hole.weather].toLowerCase()}. ${BIOMES[hole.biome].radio} Today’s word from the dock: ${hole.mission.title}. ${hole.mission.text}.`;
    const scene = new DriveScene(hole, this.dashSections(), radio, PHASE_SECONDS.drive!);
    setScene(scene);
    audio.music('drive');
    audio.ambience({ engine: true });
    show((root) => {
      const tipBox = h('div', { style: 'position:absolute;left:50%;top:150px;transform:translateX(-50%);pointer-events:none' });
      const onClick = (e: PointerEvent) => {
        const cv = gameCanvas()!;
        const r = cv.getBoundingClientRect();
        const s = stageScale();
        const x = (e.clientX - r.left) / s;
        const y = (e.clientY - r.top) / s;
        const hit = scene.hits.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
        if (!hit) return;
        scene.flick(hit.si, hit.oi);
        audio.sfx('flick');
        const o = scene.sections[hit.si]?.ornaments[hit.oi];
        if (o) {
          tipBox.replaceChildren(h('div', { style: 'width:460px;animation:pop .15s' }, ornCard(o, { compact: true, extra: [h('div.small.dim', `${scene.sections[hit.si]!.name}’s dash`)] })));
          clearTimeout(tipT);
          tipT = window.setTimeout(() => tipBox.replaceChildren(), 3500);
        }
      };
      let tipT = 0;
      window.addEventListener('pointerdown', onClick);
      const timer = window.setInterval(() => {
        if (scene.t >= scene.dur && this.role !== 'guest') {
          clearInterval(timer);
          this.next();
        }
      }, 100);
      root.appendChild(
        h(
          'div.pass',
          { style: 'position:absolute;inset:0' },
          h(
            'div.hud-box',
            { style: 'position:absolute;left:50%;top:22px;transform:translateX(-50%);text-align:center;animation:rise .4s' },
            h('div.hud-label', `Hole ${this.st.hole + 1} of ${this.st.cfg.holes.length} · ${BIOMES[hole.biome].name} · ${TIME_ICON[hole.time]} ${TIME_NAMES[hole.time]} · ${WEATHER_ICON[hole.weather]} ${WEATHER_NAMES[hole.weather]}`),
            h('div.display', { style: 'font-size:34px' }, `Driving to ${hole.name}`),
            h('div', { style: 'font-weight:700' }, `Mission: ${hole.mission.title}. ${hole.mission.text}.`),
          ),
          tipBox,
          h('div.small', { style: 'position:absolute;left:50%;bottom:16px;transform:translateX(-50%);color:#fff;opacity:.75' }, 'Click an ornament on the dash to give it a flick and read its perks.'),
          this.solo ? h('button', { style: 'position:absolute;right:24px;bottom:24px', onclick: () => (clearInterval(timer), this.next()) }, 'Skip ▶') : '',
        ),
      );
      return () => {
        clearInterval(timer);
        window.removeEventListener('pointerdown', onClick);
      };
    });
  }

  // ------------------------------------------------------------------ fishing

  seats(): SeatInfo[] {
    const p = session.profile;
    if (this.solo) return [{ id: this.me, name: displayName(), look: p.look, color: SEAT_COLORS[0]!, x: 0, lure: this.st.loadout.lure }];
    const xs = seatXs(this.players.length);
    return [...this.players].sort((a, b) => a.slot - b.slot).map((pl, i) => ({ id: pl.id, name: pl.name, look: pl.id === this.me ? p.look : pl.look, color: pl.color, x: xs[i]!, lure: pl.id === this.me ? this.st.loadout.lure : pl.lure }));
  }

  stats() {
    return loadoutStats(this.st.loadout, session.profile.ornaments, this.st.cfg.mods);
  }

  private fishScreen(): void {
    const hole = this.hole;
    this.treasureCash = 0;
    this.catchesThisHole = [];
    const stats = this.stats();
    show((root) => {
      const f = new FishingSession(root, {
        spec: hole,
        holes: this.st.cfg.holes.length,
        mods: this.st.cfg.mods,
        stats,
        charms: this.st.loadout.charms,
        seed: (this.st.cfg.seed ^ (hole.idx * 7919)) + hashId(this.me),
        me: this.me,
        seats: this.seats(),
        authority: this.role !== 'guest',
        runScore: this.st.score,
        cash: () => this.st.cash + this.treasureCash,
        board: this.solo ? undefined : () => this.players.map((p) => ({ id: p.id, name: p.name, color: p.color, score: p.id === this.me ? this.st.score + (this.fishing?.angler.points ?? 0) : p.score })),
        onEvent: (e, a) => this.onFishEvent(e, a),
        onDone: () => this.fishDone(),
        onQuit: () => (this.solo ? this.leave() : void import('./lobby').then((m) => m.leaveCoop())),
        onShove: this.solo ? undefined : (to, s) => this.shove(to, s),
        send: this.link ? (m) => this.fromFishing(m) : undefined,
      });
      if (this.role === 'host') {
        const best = Math.max(f.angler.d.legend, ...this.players.filter((p) => p.id !== this.me).map((p) => p.legend));
        f.world.legendChance = best;
        const rates = this.players.map((p) => (p.id === this.me ? 1 + Math.max(-0.5, stats.bubbleRate) : 1 + Math.max(-0.5, p.bubbleRate)));
        f.world.rate = rates.reduce((x, y) => x + y, 0) / rates.length;
      }
      this.fishing = f;
      f.remoteViews = this.views;
      return () => {
        f.dispose();
        if (this.fishing === f) this.fishing = null;
      };
    });
  }

  /** what the fishing screen wants to tell the others: a guest tells the host; the host already shares its lake and
   *  its angler in the heartbeat, so it only passes on its own news, with its name on it */
  private fromFishing(m: Record<string, unknown>): void {
    if (this.role === 'guest') return this.link!.send(m);
    if (m.t === 'feed') this.link!.send({ t: 'feed', text: `${displayName()} ${String(m.text)}` });
  }

  private onFishEvent(e: AEvent, a: Angler): void {
    const p = session.profile;
    if (e.k === 'catch') {
      const r = logCatch(p, e.c);
      e.c.firstEver = r.firstEver;
      e.c.record = r.record;
      this.catchesThisHole.push(e.c);
      if (e.c.id === 'marlene') this.landedHer();
      saveSoon();
      this.keepPartial();
      this.sendStatus();
    } else if (e.k === 'treasure') {
      const rw = e.reward;
      if (rw.kind === 'cash') {
        this.treasureCash += rw.amount;
        this.fishing?.feed(`Treasure: $${rw.amount}`);
      } else if (rw.kind === 'charm') {
        const left = CHARMS.filter((c) => !this.st.charms.includes(c.id));
        if (left.length) {
          const c = new Rng(rw.seed).pick(left);
          this.st.charms.push(c.id);
          if (this.st.loadout.charms.length < CHARM_SLOTS) this.st.loadout.charms.push(c.id);
          this.fishing?.feed(`Treasure: the ${c.name} charm! (${c.text})`);
          toast(`Treasure! ${c.name}: ${c.text}`, 'gold', 4000);
        } else this.treasureCash += 150;
      } else {
        const o = rollOrnament(new Rng(rw.seed), 'treasure', newOrnamentId(p), Date.now());
        this.giveOrnament(o, 'Treasure');
      }
      this.keepPartial();
      this.sendStatus();
    }
    void a;
  }

  /** the hole so far, kept with the run (solo): a refresh ends the hole with these instead of replaying it */
  private keepPartial(): void {
    if (!this.solo) return;
    this.st.partial = { hole: this.st.hole, catches: this.catchesThisHole, treasureCash: this.treasureCash };
    this.persist();
  }

  /** an ornament into the glovebox (or sold on the spot when it's full) */
  giveOrnament(o: Ornament, from: string): void {
    const p = session.profile;
    if (p.ornaments.length >= GLOVEBOX_MAX) {
      this.st.cash += 100;
      toast(`${from}: the glovebox is full, so you sold the ${o.name} for $100.`, 'gold', 4500);
      return;
    }
    p.ornaments.push(o);
    this.st.found.push(o.id);
    saveSoon();
    audio.sfx('treasure');
    const close = modal(h('div.col', { style: 'width:520px;align-items:center;text-align:center' }, h('h2', `${from}!`), h('div.dim', 'A new dash ornament for your glovebox.'), ornCard(o), h('button.primary', { onclick: () => close() }, 'Sweet')), {});
    setTimeout(() => close(), 6000);
  }

  private landedHer(): void {
    const p = session.profile;
    p.stats.marlene += 1;
    const o = rollOrnament(new Rng(Date.now()), 'marlene', newOrnamentId(p), Date.now());
    if (!p.owned.includes('keeper')) {
      p.owned.push('keeper');
      setTimeout(() => toast('You earned The Keeper’s Rod!', 'gold', 6000), 4500);
    }
    setTimeout(() => this.giveOrnament(o, 'Marlene left you a gift'), 3500);
  }

  private fishDone(): void {
    if (this.role === 'guest') {
      this.link!.send({ t: 'done', score: this.st.score + (this.fishing?.angler.points ?? 0) });
      const me = this.myPlayer();
      if (me) me.done = true;
      this.fishing?.banner('Waiting for the others…', '', 60000);
      return;
    }
    const me = this.myPlayer();
    if (me) me.done = true;
    if (this.solo) this.next();
    else this.fishing?.banner('Waiting for the others…', '', 60000);
  }

  private endHole(): void {
    const hole = this.hole;
    const res: HoleResult = holeResult(this.catchesThisHole, hole, this.treasureCash);
    this.st.results[hole.idx] = res;
    this.st.score += res.total;
    this.st.cash += res.total + this.treasureCash;
    this.holeTotals[hole.idx] = this.st.score;
    this.treasureCash = 0;
    this.catchesThisHole = [];
    delete this.st.partial;
    saveSoon();
    this.sendStatus(true);
  }

  // ------------------------------------------------------------------ the end

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    const p = session.profile;
    const cfg = this.st.cfg;
    p.stats.runs += 1;
    p.stats.total += this.st.score;
    p.stats.best = Math.max(p.stats.best, this.st.score);
    const all = this.st.results.flatMap((r) => r?.catches ?? []);
    const best = [...all].sort((a, b) => b.points - a.points)[0];
    let rank: number | undefined;
    if (!this.solo) {
      const order = [...this.players].sort((a, b) => b.score - a.score);
      rank = order.findIndex((x) => x.id === this.me) + 1;
    }
    const bestText = best ? `${Math.round(best.cm)} cm ${FISH[best.id]?.name}` : '';
    const row: HistoryRow = { at: Date.now(), mode: cfg.mode, score: this.st.score, holes: cfg.holes.map((x) => x.name), fish: all.length, best: bestText };
    if (!this.solo) Object.assign(row, { rank, players: this.players.length });
    if (all.some((c) => c.id === 'marlene')) row.marlene = true;
    const topPlace = recordRun(p, row, weekOf(today()));
    let dailyReward: Ornament | null = null;
    if (cfg.mode === 'daily' && cfg.date) {
      p.stats.dailies += 1;
      if (p.daily.date !== cfg.date) p.daily = { date: cfg.date, best: 0, reward: false };
      p.daily.best = Math.max(p.daily.best, this.st.score);
      if (!p.daily.reward && p.ornaments.length < GLOVEBOX_MAX) {
        p.daily.reward = true;
        dailyReward = rollOrnament(new Rng(`${cfg.date}:${session.user?.id ?? 'local'}`), 'daily', newOrnamentId(p), Date.now());
        p.ornaments.push(dailyReward);
      }
      if (session.online) void api.postDaily(cfg.date, this.st.score, bestText, all.length).catch(() => {});
    }
    void saveNow().catch(() => {});
    resultsScreen(this, { best, dailyReward, rank, topPlace });
  }

  leave(): void {
    if (this.solo) keepRun(null);
    this.dispose();
    garage();
  }

  /** pick a saved run back up (after a refresh). A hole that was being fished ends there, with what was caught. */
  resume(st: RunState): void {
    stopDemo();
    this.st = st;
    if (st.phase === 'fish') {
      const part = st.partial?.hole === st.hole ? st.partial : null;
      this.catchesThisHole = part ? [...part.catches] : [];
      this.treasureCash = part?.treasureCash ?? 0;
      this.enter('tally');
      return;
    }
    this.enter(st.phase);
  }

  /** keep a solo run in this tab's storage now (after a purchase, a catch…), so a refresh can't undo or redo it */
  persist(): void {
    if (this.solo) keepRun(this.st.phase === 'results' ? null : this.st);
  }

  // ------------------------------------------------------------------ co-op

  sendStatus(force = false): void {
    if (!this.link) return;
    const score = this.st.score + (this.fishing?.angler.points ?? 0);
    if (!force && score === this.sentScore) return;
    this.sentScore = score;
    const me = this.myPlayer();
    if (me) me.score = score;
    const p = session.profile;
    const stats = this.stats();
    const d = derived(stats);
    const status = { t: 'status', score, ready: !!me?.ready, done: this.st.phase === 'fish' && !!me?.done, dash: this.st.loadout.dash.map((id) => ornamentById(p, id)).filter(Boolean), lure: this.st.loadout.lure, legend: d.legend, bubbleRate: stats.bubbleRate, look: p.look };
    if (this.role === 'guest') this.link.send(status);
    else this.broadcastPlayers();
  }

  broadcastPlayers(): void {
    if (this.role !== 'host') return;
    this.link!.send({ t: 'players', list: this.players });
  }

  private onMsg(msg: Record<string, unknown>, from?: string): void {
    const t = msg.t;
    if (this.role === 'host' && from) {
      const pl = this.players.find((p) => p.id === from);
      if (!pl) return;
      if (t === 'status') {
        pl.score = Number(msg.score) || 0;
        pl.ready = !!msg.ready;
        pl.done = this.st.phase === 'fish' && (!!msg.done || pl.done);
        pl.dash = Array.isArray(msg.dash) ? (msg.dash as Ornament[]).slice(0, 3) : pl.dash;
        pl.lure = String(msg.lure || pl.lure);
        pl.legend = Number(msg.legend) || 0;
        pl.bubbleRate = Number(msg.bubbleRate) || 0;
        if (msg.look) pl.look = msg.look as AnglerLook;
        this.broadcastPlayers();
        this.onPhase?.();
      } else if (t === 'view') this.views.set(from, msg.v as AnglerView);
      else if (t === 'claim') {
        const w = this.fishing?.world;
        // two anglers can't both have Her: whoever's claim reached the host first keeps her
        if (msg.legend && w && w.legend !== 1) this.link!.send({ t: 'deny', to: from });
        else w?.claim(Number(msg.id));
      } else if (t === 'legendLost') this.fishing?.world.legendGone();
      else if (t === 'push') {
        // a guest shoved someone: us, or pass it on with who did it
        if (msg.to === this.me) this.takeShove({ ...msg, fromName: pl.name });
        else this.link!.send({ ...msg, t: 'push', from, fromName: pl.name });
      } else if (t === 'done') {
        if (this.st.phase !== 'fish') return;
        pl.done = true;
        pl.score = Number(msg.score) || pl.score;
      } else if (t === 'feed') {
        const text = `${pl.name} ${String(msg.text).slice(0, 120)}`;
        this.fishing?.feed(text);
        this.link!.send({ t: 'feed', text });
      }
      return;
    }
    if (this.role === 'guest') {
      if (t === 'phase') {
        this.st.hole = Number(msg.hole) || 0;
        if (msg.phase === 'shop') this.st.shopVisit = this.st.hole;
        this.enter(msg.phase as RunPhase, Number(msg.ms) || undefined);
      } else if (t === 'world') this.fishing?.applyWorld(msg.s as WorldSnap);
      else if (t === 'views') {
        for (const [id, v] of Object.entries(msg.v as Record<string, AnglerView>)) if (id !== this.me) this.views.set(id, v);
      } else if (t === 'players') {
        const list = msg.list as CoopPlayer[];
        for (const np of list) {
          const pl = this.players.find((p) => p.id === np.id);
          if (!pl) this.players.push(np);
          else if (np.id !== this.me) Object.assign(pl, np);
          else pl.online = np.online;
        }
        this.onPhase?.();
      } else if (t === 'feed') {
        if (!String(msg.text).startsWith(displayName() + ' ')) this.fishing?.feed(String(msg.text));
      } else if (t === 'deny' && msg.to === this.me) this.fishing?.denyLegend();
      else if (t === 'push' && msg.to === this.me) this.takeShove(msg);
    }
  }

  /** we shoved someone: a guest tells the host, who passes it on (or takes it, if the host is the one shoved) */
  private shove(to: string, s: { str: number; spook: number; dir: number }): void {
    const msg = { t: 'push', to, from: this.me, fromName: displayName(), str: s.str, spook: s.spook, dir: s.dir };
    this.link?.send(msg);
  }

  /** a shove reached us (numbers clamped: they came over the network) */
  private takeShove(m: Record<string, unknown>): void {
    const num = (v: unknown, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number(v) || 0));
    this.fishing?.pushed(num(m.str, 0, 4), num(m.spook, 0, 3), Math.sign(Number(m.dir)) || 1, String(m.fromName || 'Someone').slice(0, 24));
  }

  /** a player whose game went away mid-run (they refreshed): they no longer hold anyone up */
  dropPlayer(id: string): void {
    const pl = this.players.find((p) => p.id === id);
    if (!pl || pl.id === this.me) return;
    pl.gone = true;
    pl.online = false;
    this.broadcastPlayers();
    this.onPhase?.();
  }

  /** the host's heartbeat: the lake to everyone, timers, everyone ready */
  private hostTick(): void {
    if (this.role !== 'host' || this.finished) return;
    const f = this.fishing;
    if (f && this.st.phase === 'fish') {
      this.link!.send({ t: 'world', s: f.world.snap() });
      const v: Record<string, AnglerView> = { [this.me]: f.angler.view() };
      for (const [id, view] of this.views) v[id] = view;
      this.link!.send({ t: 'views', v });
      this.sendStatus();
      if (f.world.over) {
        if (!this.overAt) this.overAt = Date.now();
        const online = this.players.filter((p) => p.online && !p.gone && p.id !== this.me);
        // everyone landed their last fish, or 30 seconds of grace ran out
        if ((online.every((p) => p.done) && this.myPlayer()?.done) || Date.now() - this.overAt > 30000) this.next();
      }
      return;
    }
    const ph = this.st.phase;
    if (ph === 'results') return;
    // the drive normally ends with its animation; if the host's tab is hidden (no animation), its deadline ends it
    if (ph === 'drive') {
      if (this.deadline && Date.now() >= this.deadline + 400) this.next();
      return;
    }
    const online = this.players.filter((p) => p.online && !p.gone);
    const allReady = online.length > 0 && online.every((p) => p.ready);
    if ((this.deadline && Date.now() >= this.deadline) || allReady) this.next();
  }

  private overAt = 0;

  /** the relay told us who's connected */
  setOnline(ids: Set<string>): void {
    for (const p of this.players) p.online = !p.gone && ids.has(p.id);
    if (this.role === 'host') this.broadcastPlayers();
    this.onPhase?.();
  }

  /** the room closed under us (guest) */
  closed(reason: string): void {
    if (this.finished) return;
    toast(`${reason} Your purchases and catches are saved.`, 'bad', 6000);
    // through enter(), so a hole being fished is counted first
    this.enter('results');
  }

  get endedFishing(): boolean {
    return this.st.phase !== 'fish';
  }
}

function hashId(s: string): number {
  let x = 0;
  for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(x) % 100000;
}

let current: Run | null = null;

export function currentRun(): Run | null {
  return current;
}

// ------------------------------------------------------------------ a solo run survives a refresh

const RESUME_KEY = 'sak.run';

function keepRun(st: RunState | null): void {
  try {
    if (st) sessionStorage.setItem(RESUME_KEY, JSON.stringify({ st, user: session.user?.id ?? 'local', at: Date.now() }));
    else sessionStorage.removeItem(RESUME_KEY);
  } catch {
    /* private window */
  }
}

/** a run this tab was in the middle of, if any (and it belongs to whoever is signed in) */
export function savedRun(): RunState | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(RESUME_KEY) || 'null') as { st: RunState; user: string; at: number } | null;
    if (!raw?.st?.cfg?.holes?.length || raw.user !== (session.user?.id ?? 'local') || Date.now() - raw.at > 6 * 3600 * 1000) return null;
    if (raw.st.cfg.mode === 'coop' || raw.st.phase === 'results') return null;
    return raw.st;
  } catch {
    return null;
  }
}

export function forgetRun(): void {
  keepRun(null);
}

export function resumeSolo(st: RunState): void {
  current?.dispose();
  const run = new Run(st.cfg, 'solo', session.user?.id ?? 'local', null, []);
  current = run;
  run.resume(st);
}

export function startSolo(cfg?: RunConfig): void {
  current?.dispose();
  const run = new Run(cfg ?? buildRun(Math.floor(Math.random() * 2 ** 31), 'solo', []), 'solo', session.user?.id ?? 'local', null, []);
  current = run;
  run.start();
}

export function startDaily(): void {
  startSolo(dailyRun(today()));
}

export function startCoop(cfg: RunConfig, role: 'host' | 'guest', me: string, link: CoopLink, players: CoopPlayer[]): Run {
  current?.dispose();
  const run = new Run(cfg, role, me, link, players);
  current = run;
  run.start();
  return run;
}

/** the daily's card: today's waters and twists, your best, and your friends' scores */
export function dailyPreview(): void {
  const date = today();
  const cfg = dailyRun(date);
  const p = session.profile;
  const board = h('div.col', { style: 'gap:6px' }, h('div.dim', session.online ? 'Loading the board…' : 'Sign in to see your friends’ scores.'));
  if (session.online)
    void api
      .daily(date)
      .then((r) =>
        board.replaceChildren(
          ...(r.rows.length ? r.rows : []).map((row, i) => h('div.card.row', { style: `padding:6px 12px;${row.me ? 'background:#fff3c8' : ''}` }, h('b', `${i + 1}.`), h('b.grow', row.name), h('span.small.dim', row.best), h('b.display', { style: 'font-size:22px' }, pts(row.score)))),
          r.rows.length ? '' : h('div.dim', 'Nobody has played today yet. Be first!'),
        ),
      )
      .catch((e) => board.replaceChildren(h('div.dim', (e as Error).message)));
  const close = modal(
    h(
      'div.col',
      { style: 'width:760px' },
      h('div.row', h('h2.grow', `Daily Catch · ${date}`), h('button', { onclick: () => close() }, 'Close')),
      h('div.small.dim', 'Same waters, missions and twists for everyone today, with your own gear. Play as often as you like: your best score counts. Your first daily each day earns a free dash ornament.'),
      h('h3', 'Today’s twists'),
      h('div.col', { style: 'gap:6px' }, ...cfg.mods.map((m) => h('div.card.row', { style: 'padding:8px 12px' }, h('span', { style: 'font-size:28px' }, MOD[m]!.glyph), h('div.col', { style: 'gap:0' }, h('b', MOD[m]!.name), h('span', MOD[m]!.text))))),
      h('h3', 'The waters'),
      h('div.row', ...cfg.holes.map((x) => h('div.card.grow', h('b', x.name), h('div.small.dim', `${BIOMES[x.biome].name} · ${TIME_NAMES[x.time]} · ${WEATHER_NAMES[x.weather]}`), h('div', { style: 'font-weight:700' }, `${x.mission.title}: `, h('span', { style: 'font-weight:500' }, x.mission.text))))),
      h('div.row', h('h3.grow', 'Today’s board'), p.daily.date === date ? h('span.chip.gold', `Your best: ${pts(p.daily.best)}`) : ''),
      board,
      h('button.primary.big', { onclick: () => (close(), startDaily()) }, 'Start the Daily Catch'),
    ),
    { wide: true },
  );
}

export { LakeScene, CHARM };
