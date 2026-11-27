// One fishing hole being played: the lake on screen, your angler driven by the mouse (or Space), the shared lake
// (run here when solo or hosting, mirrored from the host otherwise), the HUD, catch cards, tips, and every sound.
import { Angler, type AEvent, type AnglerInput, type AnglerView } from '../core/angler';
import { Bot } from '../core/bot';
import { BASE, type Stats } from '../core/stats';
import { missionMultFor } from '../core/scoring';
import { QUALITY_NAME } from '../core/scoring';
import type { AnglerLook, Catch, HoleSpec } from '../core/types';
import { HoleWorld, type WorldSnap } from '../core/world';
import { FISH } from '../data/fish';
import { CHARM, MOD } from '../data/charms';
import { BIOMES, TIME_ICON, TIME_NAMES, WEATHER_ICON, WEATHER_NAMES } from '../data/spots';
import { gameCanvas, onTick, setScene } from '../render/canvas';
import { fishPic } from '../render/pics';
import { LakeScene, SHORE_Y, unproject, type LakeAngler } from '../render/lake';
import { drawCastMeter, drawHookPrompt, drawReel } from '../render/reelpanel';
import { audio } from '../audio/audio';
import { session, saveSoon } from '../session';
import { stageScale } from './stage';
import { h, modal } from './dom';
import { charmIcon, money, pts } from './widgets';

export interface SeatInfo {
  id: string;
  name: string;
  look: AnglerLook;
  color: string;
  x: number;
  lure: string;
}

export const SEAT_COLORS = ['#ffcc33', '#2ec4b6', '#ff8a5a', '#b48aff'];

/** development only: ?bot lets a bot fish for you (testing, and recording the games-page clip) */
const autoBot = import.meta.env.DEV && new URLSearchParams(location.search).has('bot') ? new Bot(Date.now() % 100000, Number(new URLSearchParams(location.search).get('bot')) || 0.97) : null;

export function seatXs(n: number): number[] {
  if (n <= 1) return [0];
  if (n === 2) return [-12, 12];
  if (n === 3) return [-20, 0, 20];
  return [-24, -8, 8, 24];
}

export interface FishingOpts {
  spec: HoleSpec;
  /** how many holes this run has */
  holes: number;
  mods: string[];
  stats: Stats;
  charms: string[];
  seed: number;
  me: string;
  seats: SeatInfo[];
  authority: boolean;
  /** score and cash before this hole */
  runScore: number;
  cash: () => number;
  /** what the others on the lake have scored (co-op board) */
  board?: () => { id: string; name: string; color: string; score: number }[];
  onEvent: (e: AEvent, a: Angler) => void;
  onDone: () => void;
  /** co-op: tell the host (or everyone) */
  send?: (msg: Record<string, unknown>) => void;
  /** the player chose to quit the run (solo) or leave the game (co-op) */
  onQuit?: () => void;
  /** co-op: we shoved another angler */
  onShove?: (to: string, s: { str: number; spook: number; dir: number }) => void;
  /** the practice pond: no clock, mission, score or tips (the tutorial coaches instead) */
  tutorial?: boolean;
}

const TIPS: Record<string, string> = {
  aim: 'Move the mouse to aim. Hold the button (or Space) to charge, let go to cast.',
  bubble: 'Cast into a bubble spot: bites come much faster, and the fish are better.',
  bite: 'A bite! Click NOW to hook it!',
  reel: 'Hold to lift the green bar, let go to let it fall. Keep the fish inside it!',
  mission: 'Fish that match the mission score big. Hit the goal and the whole hole scores ×1.5.',
};

export class FishingSession {
  scene: LakeScene;
  world: HoleWorld;
  angler: Angler;
  private o: FishingOpts;
  private input: AnglerInput = { held: false, pressed: false, released: false, cancel: false, aim: 0 };
  private mouse = { x: 800, y: 500 };
  private offs: (() => void)[] = [];
  private hud!: HTMLElement;
  private els: Record<string, HTMLElement> = {};
  private last: Record<string, string> = {};
  private me: LakeAngler;
  private done = false;
  private ended = false;
  private hint = '';
  private hintEl: HTMLElement | null = null;
  private cardTimer = 0;
  private sendT = 0;
  private legendUp = false;
  private reelSoundT = 0;
  remoteViews = new Map<string, AnglerView>();

  constructor(root: HTMLElement, o: FishingOpts) {
    this.o = o;
    this.world = new HoleWorld(o.spec, o.mods);
    const mine = o.seats.find((s) => s.id === o.me)!;
    // your own stretch of shore: halfway to each neighbour (a little short of it), or 14 m each way alone
    const xs = o.seats.map((s) => s.x).sort((a, b) => a - b);
    const left = xs.filter((x) => x < mine.x).pop();
    const right = xs.find((x) => x > mine.x);
    const lane: [number, number] = [left === undefined ? Math.max(-36, mine.x - 14) : (left + mine.x) / 2 + 1.5, right === undefined ? Math.min(36, mine.x + 14) : (right + mine.x) / 2 - 1.5];
    this.angler = new Angler({ x: mine.x, seed: o.seed, stats: o.stats, hole: o.spec, mods: o.mods, charms: o.charms, lane });
    this.world.legendChance = this.angler.d.legend;
    this.world.rate = 1 + Math.max(-0.5, o.stats.bubbleRate);
    this.scene = new LakeScene(o.spec);
    this.scene.world = this.world;
    this.scene.anglers = o.seats.map((s) => ({ id: s.id, name: s.name, look: s.look, view: s.id === o.me ? this.angler.view() : { x: s.x, phase: 'ready', aim: 0, power: 0, bx: s.x, bz: 0, bh: 0, dip: 0, fish: '', prog: 0, fy: 0.5 }, local: s.id === o.me, color: s.color, pt: 0, lastPhase: '', shownCm: 0, lure: s.lure }));
    this.me = this.scene.anglers.find((a) => a.local)!;
    this.scene.overlay = (c, now) => this.overlay(c, now);
    setScene(this.scene);
    this.buildHud(root);
    this.bindInput();
    this.offs.push(onTick((dt) => this.tick(dt)));
    // a hidden tab gets no animation frames: the host keeps the shared lake (its clock, bubbles) running anyway
    if (o.authority) {
      const iv = window.setInterval(() => {
        const now = performance.now();
        if (now - this.lastTick > 300 && !this.ended && !this.paused) {
          this.world.update(Math.min(5, (now - this.lastTick) / 1000));
          this.lastTick = now;
        }
      }, 250);
      this.offs.push(() => clearInterval(iv));
    }
    const night = o.spec.time === 'night' || o.spec.time === 'dusk';
    audio.music(night ? 'night' : 'fish');
    audio.ambience({ water: true, birds: o.spec.time === 'day' || o.spec.time === 'dawn', crickets: night, rain: o.spec.weather === 'rain' || o.spec.weather === 'storm', wind: o.spec.weather === 'snow' || !!this.world.flags.wind });
    audio.sfx('whistle');
    if (!o.tutorial) {
      this.banner(`${o.spec.name}`, `${o.spec.mission.title}: ${o.spec.mission.text}`, 2600);
      this.tip('aim');
    }
  }

  dispose(): void {
    for (const f of this.offs) f();
    this.offs = [];
    this.hud?.remove();
  }

  // ------------------------------------------------------------------ input

  private bindInput(): void {
    const cv = gameCanvas()!;
    const toStage = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      const s = stageScale();
      this.mouse = { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s };
    };
    const down = (e: PointerEvent) => {
      if (this.paused || (e.target as HTMLElement).closest('button, .modal-back')) return;
      toStage(e);
      if (e.button === 2) {
        this.input.cancel = true;
        return;
      }
      if (e.button !== 0) return;
      this.input.pressed = true;
      this.input.held = true;
    };
    const up = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (this.input.held) this.input.released = true;
      this.input.held = false;
    };
    const kd = (e: KeyboardEvent) => {
      if (this.paused) return;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = true;
      if (e.repeat) return;
      if (e.code === 'KeyE') this.tryShove();
      if (e.code === 'Space') {
        e.preventDefault();
        this.input.pressed = true;
        this.input.held = true;
      } else if (e.code === 'Escape') {
        // Escape takes back a cast you're charging or waiting on; otherwise it opens the menu
        const ph = this.angler.phase;
        if (ph === 'charging' || ph === 'waiting') this.input.cancel = true;
        else if (!document.querySelector('.modal-back')) this.pauseMenu();
      }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = false;
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.input.held) this.input.released = true;
        this.input.held = false;
      }
    };
    const blur = () => {
      if (this.input.held) this.input.released = true;
      this.input.held = false;
      this.keys.left = this.keys.right = false;
    };
    window.addEventListener('pointermove', toStage);
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    this.offs.push(() => {
      window.removeEventListener('pointermove', toStage);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
    });
  }

  private aimFromMouse(): number {
    const st = this.scene.standAt(this.angler.x);
    if (this.mouse.y >= SHORE_Y - 6) return Math.max(-1.05, Math.min(1.05, (this.mouse.x - st.x) / 420));
    const w = unproject(this.mouse.x, this.mouse.y);
    return Math.atan2(w.x - this.angler.x, Math.max(1, w.z));
  }

  // ------------------------------------------------------------------ every frame

  private lastTick = performance.now();
  /** solo only: the menu is open and the lake stands still */
  private paused = false;
  private keys = { left: false, right: false };
  /** seconds until the next shove (co-op) */
  shoveCd = 0;

  /** E: shove the nearest angler within reach (co-op only) */
  private tryShove(): void {
    if (!this.o.onShove || this.ended) return;
    const head = this.standY();
    if (this.shoveCd > 0) return;
    const range = this.angler.d.shoveRange;
    let best: LakeAngler | null = null;
    for (const a of this.scene.anglers) {
      if (a.local || a.view.phase === 'done') continue;
      if (Math.abs(a.view.x - this.angler.x) <= range && (!best || Math.abs(a.view.x - this.angler.x) < Math.abs(best.view.x - this.angler.x))) best = a;
    }
    if (!best) {
      this.scene.float('Nobody close enough', head.x, head.y, '#cfe8ff', 20);
      return;
    }
    const dir = Math.sign(best.view.x - this.angler.x) || 1;
    this.angler.pushT = 0.4;
    this.angler.pushDir = dir;
    this.shoveCd = this.angler.d.shoveCooldown;
    audio.sfx('bump');
    this.scene.float('SHOVE!', head.x + dir * 60, head.y, '#ffb36a', 30);
    this.o.onShove(best.id, { str: this.angler.d.shoveStr, spook: this.angler.d.shoveSpook, dir });
    this.o.send?.({ t: 'feed', text: `shoved ${best.name}!` });
  }

  /** another angler shoved us */
  pushed(str: number, spook: number, dir: number, from: string): void {
    const hit = this.angler.shoved(str, spook, dir);
    if (!hit) return;
    const head = this.standY();
    audio.sfx('bump');
    audio.sfx('bad');
    this.scene.float(`${from} shoved you!`, head.x, head.y - 20, '#ff9a7a', 28);
    if (session.profile.settings.shake) this.scene.shake = 6 + hit * 4;
  }

  pauseMenu(): void {
    const solo = !this.o.send;
    if (solo) this.paused = true;
    this.input.held = false;
    const p = session.profile;
    const slider = (label: string, v: number, set: (x: number) => void) => {
      const inp = h('input', { type: 'range', min: '0', max: '100', value: String(Math.round(v * 100)), style: 'flex:1;padding:0' }) as HTMLInputElement;
      inp.addEventListener('input', () => (set(Number(inp.value) / 100), audio.setVolumes(p.settings.sfx, p.settings.music)));
      inp.addEventListener('change', () => saveSoon());
      return h('div.row', h('b', { style: 'width:90px' }, label), inp);
    };
    const close = modal(
      h(
        'div.col',
        { style: 'width:440px' },
        h('h2', solo ? 'Paused' : 'Menu'),
        solo ? '' : h('div.small.dim', 'The lake keeps going for everyone else.'),
        slider('Sound', p.settings.sfx, (x) => (p.settings.sfx = x)),
        slider('Music', p.settings.music, (x) => (p.settings.music = x)),
        h('button.primary.big', { onclick: () => close() }, 'Back to fishing'),
        h(
          'button.red',
          {
            onclick: () => {
              close();
              this.o.onQuit?.();
            },
          },
          solo ? 'Quit this run' : 'Leave the game',
        ),
        h('div.small.dim', solo ? 'Quitting ends the run here. Anything you bought is still yours.' : 'Your catches and purchases so far are saved.'),
      ),
      {
        onClose: () => {
          this.paused = false;
          this.lastTick = performance.now();
        },
      },
    );
  }

  private tick(dt: number): void {
    if (this.ended || this.paused) return;
    this.lastTick = performance.now();
    if (this.o.authority) this.world.update(dt);
    else this.world.tick(dt);
    if (autoBot) {
      const b = autoBot.input(this.angler, this.world, dt);
      Object.assign(this.input, b, { pressed: b.pressed || this.input.pressed });
    } else this.input.aim = this.aimFromMouse();
    this.input.move = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    this.shoveCd = Math.max(0, this.shoveCd - dt);
    const ev = this.angler.update(dt, this.input, this.world);
    this.input.pressed = false;
    this.input.released = false;
    this.input.cancel = false;
    for (const e of ev) this.handle(e);
    this.me.view = this.angler.view();
    for (const a of this.scene.anglers) if (!a.local) a.view = this.remoteViews.get(a.id) ?? a.view;
    // the aim guide
    const ph = this.angler.phase;
    if (ph === 'ready' || ph === 'charging') {
      const land = this.angler.landingFor(this.angler.power);
      this.scene.guide = { x: this.angler.x, aim: this.angler.aim, reach: this.angler.reach, charging: ph === 'charging', power: this.angler.power, landX: land.x, landZ: land.z, inBubble: !!this.world.bubbleAt(land.x, land.z) };
    } else this.scene.guide = null;
    // reel clicks
    if (ph === 'reeling' && this.angler.bar) {
      this.reelSoundT -= dt;
      if (this.reelSoundT <= 0 && this.input.held) {
        audio.sfx('reel');
        this.reelSoundT = 0.07;
      }
    }
    // co-op: our angler's picture for the others
    this.sendT -= dt;
    if (this.o.send && this.sendT <= 0) {
      this.sendT = 0.1;
      this.o.send({ t: 'view', v: this.me.view });
    }
    // her ripple appears
    if (this.world.legend === 1 && !this.legendUp) {
      this.legendUp = true;
      const b = this.world.bubbles.find((x) => x.legend);
      audio.sfx('legend');
      audio.music('legend');
      if (b) this.scene.leap(b.x, b.z + 4, 'marlene', 3.4, b.x > 0 ? -1 : 1);
      this.banner('SHE’S HERE', 'Cast into the golden ripple!', 3000, true);
    }
    this.updateHud();
    if (this.world.over && !this.done) {
      this.done = true;
      audio.sfx('horn');
      this.banner('Time!', this.angler.phase === 'reeling' ? 'Land that last fish!' : '', 1800);
    }
    if (this.done && this.angler.phase === 'done' && !this.ended) {
      this.ended = true;
      this.scene.guide = null;
      this.o.onDone();
    }
  }

  /** a guest gets the shared lake from the host */
  applyWorld(s: WorldSnap): void {
    this.world.apply(s);
  }

  /** the host says another angler hooked Her a moment before we did */
  denyLegend(): void {
    if (!this.angler.forfeitLegend()) return;
    const head = this.standY();
    audio.sfx('escape');
    this.scene.float('Beaten to Her!', head.x, head.y, '#ffd27a', 32);
    this.banner('Beaten to it!', 'Someone else hooked Her a split second earlier.', 2400);
    audio.music(this.o.spec.time === 'night' || this.o.spec.time === 'dusk' ? 'night' : 'fish');
  }

  private standY(): { x: number; y: number } {
    const st = this.scene.standAt(this.angler.x);
    return { x: st.x, y: st.y - 200 };
  }

  private handle(e: AEvent): void {
    const sc = this.scene;
    const head = this.standY();
    switch (e.k) {
      case 'charge':
        audio.sfx('charge');
        break;
      case 'cast':
        audio.sfx('cast');
        if (e.perfect) {
          audio.sfx('perfect');
          sc.float('PERFECT CAST', head.x, head.y - 30, '#ffd23a', 30);
        }
        this.tip('bubble', () => this.world.bubbles.length > 0);
        this.clearTip('aim');
        break;
      case 'land':
        sc.splash(e.x, e.z, e.legend ? 26 : 12, e.legend ? '#ffe7a0' : '#e8f6ff');
        audio.sfx('plop');
        if (e.legend) sc.float('!!!', head.x, head.y - 40, '#ffd23a', 44);
        else if (e.bullseye) sc.float('BULLSEYE!', head.x, head.y - 30, '#ffd23a', 32);
        else if (e.bubble) sc.float('BUBBLES!', head.x, head.y - 30, '#7cff9a', 28);
        if (e.bubble) this.clearTip('bubble');
        break;
      case 'nibble':
        audio.sfx('nibble');
        sc.ripple(this.angler.bx, this.angler.bz, 0.8);
        break;
      case 'bite':
        audio.sfx('bite');
        sc.ripple(this.angler.bx, this.angler.bz, 1.6);
        sc.splash(this.angler.bx, this.angler.bz, 6);
        this.tip('bite');
        break;
      case 'claim':
        if (this.o.authority) this.world.claim(e.id);
        else {
          this.world.claim(e.id);
          this.o.send?.({ t: 'claim', id: e.id, legend: e.legend });
        }
        if (e.legend) {
          this.banner('SHE’S ON YOUR LINE', 'Don’t let go…', 2200, true);
          this.o.send?.({ t: 'feed', text: 'has Her on the line!!' });
        }
        break;
      case 'hook':
        audio.sfx('hook');
        this.clearTip('bite');
        this.tip('reel');
        break;
      case 'save':
        sc.float('SAVED!', head.x, head.y, '#7cff9a', 28);
        break;
      case 'miss':
        audio.sfx('bad');
        sc.float(e.legend ? 'She slipped the hook…' : 'Missed it!', head.x, head.y, '#ffb0a0', 26);
        if (e.legend) this.loseLegend();
        this.clearTip('bite');
        break;
      case 'early':
        sc.float('Reeled in', head.x, head.y, '#ffffff', 22);
        break;
      case 'catch':
        this.onCatch(e.c, !!e.second);
        break;
      case 'escape':
        audio.sfx('escape');
        sc.float(e.legend ? 'SHE GOT AWAY' : 'Got away!', head.x, head.y, '#ffb0a0', e.legend ? 40 : 28);
        if (e.legend) {
          this.loseLegend();
          this.banner('She got away…', 'Maybe next time.', 2400);
        }
        this.clearTip('reel');
        if (session.profile.settings.shake) sc.shake = 4;
        break;
      case 'treasure':
        audio.sfx('treasure');
        sc.sparkle(head.x, head.y, 22, '#ffd23a');
        break;
      case 'snap':
        sc.float('SNAP! Re-tying the line…', head.x, head.y - 30, '#ff8a7a', 26);
        break;
      case 'lost-bubble':
        sc.float('The bubbles are gone', head.x, head.y, '#cfe8ff', 20);
        break;
    }
    this.o.onEvent(e, this.angler);
  }

  private loseLegend(): void {
    if (this.o.authority) this.world.legendGone();
    else {
      this.world.legendGone();
      this.o.send?.({ t: 'legendLost' });
    }
    audio.music(this.o.spec.time === 'night' || this.o.spec.time === 'dusk' ? 'night' : 'fish');
  }

  private onCatch(c: Catch, second: boolean): void {
    const sc = this.scene;
    const head = this.standY();
    const sp = FISH[c.id]!;
    this.me.shownCm = c.cm;
    const legend = c.id === 'marlene';
    if (legend) {
      audio.sfx('legendCatch');
      this.banner('YOU LANDED HER!', `Marlene · ${Math.round(c.cm)} cm`, 4200, true);
      sc.leap(this.angler.bx, this.angler.bz, 'marlene', 3.6, 1);
      sc.sparkle(head.x, head.y, 60, '#ffd23a');
      if (session.profile.settings.shake) sc.shake = 14;
      this.loseLegend();
    } else audio.sfx(c.firstEver ? 'new' : 'catch');
    sc.float(`+${pts(c.points)}`, head.x, head.y - (second ? 60 : 0), c.mission ? '#7cff9a' : '#ffffff', c.points >= 500 ? 44 : 34);
    if (c.perfect) audio.sfx('perfect');
    this.showCard(c, sp.name);
    this.clearTip('reel');
    if (c.mission) this.tip('mission');
    this.o.send?.({ t: 'feed', text: `caught ${second ? 'another ' : 'a '}${Math.round(c.cm)} cm ${sp.name} (+${pts(c.points)})` });
  }

  // ------------------------------------------------------------------ HUD

  private buildHud(root: HTMLElement): void {
    const s = this.o.spec;
    const mission = s.mission;
    this.els.clock = h('div.hud-clock', `${Math.floor(s.seconds / 60)}:${String(Math.round(s.seconds % 60)).padStart(2, '0')}`);
    this.els.score = h('div.hud-score', '0');
    this.els.cash = h('div.cash', { style: 'font-size:22px' }, '$0');
    this.els.streak = h('div.small', { style: 'font-weight:800;color:#d8642a' });
    this.els.pips = h('div.pips');
    this.els.mission = h(
      'div.hud-box.mission',
      h('div.row', { style: 'gap:8px' }, h('span.title', mission.title), h('span.chip', `×${+missionMultFor(mission, this.o.stats, !!this.world.flags.missionDouble).toFixed(2)}`)),
      h('div', { style: 'font-weight:600;font-size:16px' }, mission.text),
      h('div.row', { style: 'gap:8px' }, this.els.pips, (this.els.count = h('b', { style: 'font-size:18px' }))),
      h('div.small.dim', `${mission.goalText} → hole ×1.5`),
    );
    this.els.board = h('div.board');
    const charms = this.o.charms.length ? h('div.row', { style: 'gap:6px;position:absolute;left:20px;bottom:20px;pointer-events:auto' }, ...this.o.charms.map((c) => charmIcon(c, true))) : '';
    const mods = this.o.mods.length ? h('div.row', { style: 'gap:6px;position:absolute;left:20px;bottom:76px' }, ...this.o.mods.map((m) => h('span.chip', { title: MOD[m]?.text }, `${MOD[m]?.glyph} ${MOD[m]?.name}`))) : '';
    // keys: walk, and in co-op the shove with its recharge
    this.els.shoveBar = h('i');
    this.els.shoveText = h('b', 'Shove');
    const keys = h(
      'div.hud-box.row',
      { style: 'position:absolute;right:20px;bottom:20px;gap:14px;padding:6px 12px;font-size:15px' },
      h('span', h('b', 'A D'), ' walk'),
      this.o.onShove ? h('span.row', { style: 'gap:6px' }, h('b', 'E'), this.els.shoveText, h('span.timerbar', { style: 'width:70px;height:12px' }, this.els.shoveBar)) : '',
    );
    this.hud = h(
      'div.pass',
      { style: 'position:absolute;inset:0' },
      h(
        'div.hud-top',
        // the tutorial has no clock, mission or score: just the coach's card (ui/tutorial.ts)
        this.o.tutorial ? '' : h('div.hud-box', h('div.hud-label', `${BIOMES[s.biome].name} · ${TIME_ICON[s.time]} ${TIME_NAMES[s.time]} · ${WEATHER_ICON[s.weather]} ${WEATHER_NAMES[s.weather]}`), h('div.row', { style: 'gap:10px' }, this.els.clock, h('div.col', { style: 'gap:0' }, h('b', s.name), h('span.small.dim', `Hole ${s.idx + 1} of ${this.o.holes}`)))),
        this.o.tutorial ? '' : this.els.mission,
        h('div.grow'),
        h('div.col', { style: 'gap:8px;align-items:flex-end' }, h('div.row', { style: 'gap:8px;align-items:flex-start' }, this.o.tutorial ? '' : h('div.hud-box', { style: 'text-align:right' }, h('div.hud-label', 'Score'), this.els.score, h('div.row', { style: 'justify-content:flex-end;gap:10px' }, this.els.streak, this.els.cash)), h('button.tiny', { style: 'pointer-events:auto;font-size:20px;padding:4px 12px', title: 'Menu (Esc)', 'aria-label': 'Menu', onclick: () => this.pauseMenu() }, '⏸')), this.o.board ? h('div.hud-box', this.els.board) : ''),
      ),
      charms,
      mods,
      keys,
      (this.els.feed = h('div.feed', { style: 'bottom:70px' })),
    );
    root.appendChild(this.hud);
    // a pip per fish for small goals; a counter for big ones
    if (mission.goal <= 8) for (let i = 0; i < mission.goal; i++) this.els.pips.appendChild(h('i'));
  }

  private set(key: string, v: string, apply: (el: HTMLElement, v: string) => void = (el, x) => (el.textContent = x)): void {
    if (this.last[key] === v) return;
    this.last[key] = v;
    apply(this.els[key]!, v);
  }

  private updateHud(): void {
    const rem = Math.ceil(this.world.remaining);
    this.set('clock', `${Math.floor(rem / 60)}:${String(rem % 60).padStart(2, '0')}`);
    this.set('clockLow', String(rem <= 20), (_e, v) => this.els.clock!.classList.toggle('low', v === 'true'));
    this.set('score', pts(this.o.runScore + this.angler.points));
    this.set('cash', money(this.o.cash() + this.angler.points));
    const st = this.angler.streak;
    this.set('streak', st >= 2 ? `🔥 ${st} in a row +${Math.round(Math.min(BASE.streakMax, st) * this.angler.d.streakStep * 100)}%` : '');
    const got = this.angler.catches.filter((c) => c.mission).length;
    this.set('pips', String(got), () => {
      const goal = this.o.spec.mission.goal;
      [...this.els.pips!.children].forEach((p, i) => p.classList.toggle('on', i < got));
      this.els.count!.textContent = goal > 8 || got >= goal ? `${Math.min(got, goal)}/${goal}${got >= goal ? ' ✓' : ''}` : '';
      this.els.mission!.classList.toggle('done', got >= goal);
    });
    if (this.o.onShove) {
      const cd = this.angler.d.shoveCooldown;
      const ready = this.shoveCd <= 0;
      this.set('shoveBar', String(Math.round((1 - this.shoveCd / cd) * 20)), (el) => (el.style.width = `${(1 - this.shoveCd / cd) * 100}%`));
      this.set('shoveText', ready ? 'Shove!' : `${Math.ceil(this.shoveCd)}s`);
    }
    if (this.o.board) {
      const rows = this.o.board().sort((a, b) => b.score - a.score);
      this.set('board', rows.map((r) => `${r.id}:${r.score}`).join('|'), () =>
        this.els.board!.replaceChildren(h('div.hud-label', 'On the lake'), ...rows.map((r, i) => h('div.r', h('span', `${i + 1}.`), h('span.dot', { style: `background:${r.color}` }), h('span.grow', r.name), h('span', pts(r.score))))),
      );
    }
  }

  feed(text: string): void {
    const el = h('div', text);
    this.els.feed?.prepend(el);
    setTimeout(() => (el.style.opacity = '0'), 4000);
    setTimeout(() => el.remove(), 4600);
    while ((this.els.feed?.children.length ?? 0) > 5) this.els.feed!.lastElementChild!.remove();
  }

  private showCard(c: Catch, name: string): void {
    this.hud.querySelector('.catch-card')?.remove();
    clearTimeout(this.cardTimer);
    const stars = c.q > 0 ? h(`span.stars.q${c.q}`, '★'.repeat(c.q) + ` ${QUALITY_NAME[c.q]}`) : '';
    const card = h(
      'div.catch-card',
      fishPic(c.id, 170, 90),
      h(
        'div.col.grow',
        { style: 'gap:2px' },
        h('div', c.firstEver ? h('span.badge.new', 'NEW!') : '', c.record ? h('span.badge', 'RECORD!') : '', c.mission ? h('span.badge.mis', 'MISSION') : '', c.perfect ? h('span.badge', { style: 'background:#c8f5cf' }, 'PERFECT') : '', c.treasure ? h('span.badge', 'TREASURE') : ''),
        h('b', { style: 'font-size:24px;line-height:1.1' }, name),
        h('div', { style: 'font-weight:700' }, `${Math.round(c.cm)} cm · ${c.kg} kg `, stars),
        h('div.small.dim', c.why.join(' · ')),
      ),
      h('div.pts', `+${pts(c.points)}`),
    );
    this.hud.appendChild(card);
    this.cardTimer = window.setTimeout(() => {
      card.classList.add('out');
      setTimeout(() => card.remove(), 400);
    }, 2600);
  }

  banner(text: string, sub = '', ms = 2000, gold = false): void {
    const b = h(`div.banner${gold ? '.gold' : ''}`, text, sub ? h('small', sub) : '');
    this.hud.appendChild(b);
    setTimeout(() => (b.style.opacity = '0'), ms);
    setTimeout(() => b.remove(), ms + 450);
  }

  // ------------------------------------------------------------------ tips

  private tip(id: keyof typeof TIPS, when?: () => boolean): void {
    if (this.o.tutorial) return;
    const p = session.profile;
    if (!p.settings.hints || p.tips.includes(id) || this.hint) return;
    if (when && !when()) return;
    this.hint = id;
    this.hintEl = h('div.hint-bar', TIPS[id]!);
    this.hud.appendChild(this.hintEl);
    if (id === 'mission') setTimeout(() => this.clearTip('mission'), 6000);
  }

  private clearTip(id: string): void {
    if (this.hint !== id) return;
    this.hint = '';
    this.hintEl?.remove();
    this.hintEl = null;
    if (!session.profile.tips.includes(id)) {
      session.profile.tips.push(id);
      saveSoon();
    }
  }

  // ------------------------------------------------------------------ canvas overlay (meters)

  private overlay(c: CanvasRenderingContext2D, now: number): void {
    const st = this.scene.standAt(this.angler.x);
    const ph = this.angler.phase;
    if (ph === 'charging') drawCastMeter(c, this.angler, st.x, st.y);
    else if (ph === 'bite') drawHookPrompt(c, this.angler, st.x, st.y, now);
    else if (ph === 'reeling') drawReel(c, this.angler, st.x, now);
    else if (ph === 'snapped') {
      c.font = '700 22px Fredoka, sans-serif';
      c.textAlign = 'center';
      c.fillStyle = '#fff';
      c.fillText(`Re-tying… ${Math.ceil((this.world.flags.snap ?? 0) - this.angler.pt)}`, st.x, st.y - 240);
    }
  }
}

export { CHARM };
