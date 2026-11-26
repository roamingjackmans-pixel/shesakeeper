// Fishing with friends: host a lobby (a 4-digit code), or join one by code, invite or from your friends list. Up to
// four anglers climb into the truck. The host can pick house rules (any of the daily modifiers) and starts the run.
// After the run everyone comes back here.
import { show } from '../app';
import { audio } from '../audio/audio';
import type { Ornament } from '../core/ornament';
import { ornamentById } from '../core/profile';
import { buildRun } from '../core/run';
import type { AnglerLook, RunConfig } from '../core/types';
import { MOD, MODS } from '../data/charms';
import { api, type FriendsView } from '../net/api';
import { CoopLink, type Msg } from '../net/coop';
import { Net, type RoomView } from '../net/socket';
import { HATS } from '../render/anglerart';
import { ornPic } from '../render/pics';
import { displayName, session } from '../session';
import { demoLake, demoScene } from './demo';
import { h, keypad, modal, toast } from './dom';
import { SEAT_COLORS } from './fishing';
import { friendRows, friendsModal } from './friends';
import { garage } from './garage';
import { currentRun, startCoop, type CoopPlayer, type Run } from './runner';

interface LobbyPlayer {
  id: string;
  name: string;
  look: AnglerLook;
  dash: Ornament[];
  slot: number;
  online: boolean;
  lure: string;
}

interface LobbyState {
  code: string;
  host: string;
  players: LobbyPlayer[];
  mods: string[];
  inRun: boolean;
}

let L: LobbyState | null = null;
let net: Net | null = null;
let link: CoopLink | null = null;
let offs: (() => void)[] = [];
let rerender: (() => void) | null = null;
const ROOM_KEY = 'sak.room';

const me = (): string => session.user?.id ?? 'local';
const isHost = (): boolean => !!L && L.host === me();

function myInfo(): Omit<LobbyPlayer, 'slot' | 'online'> {
  const p = session.profile;
  return { id: me(), name: displayName(), look: p.look, dash: p.loadout.dash.map((id) => ornamentById(p, id)).filter(Boolean) as Ornament[], lure: p.loadout.lure };
}

function remember(code: string | null, role?: 'host' | 'guest'): void {
  try {
    if (code) sessionStorage.setItem(ROOM_KEY, JSON.stringify({ code, role }));
    else sessionStorage.removeItem(ROOM_KEY);
  } catch {
    /* private */
  }
}

function teardown(): void {
  for (const f of offs) f();
  offs = [];
  link = null;
  L = null;
}

/** leave the lobby (and any run under way) and go back to the garage */
export function leaveCoop(): void {
  leaveLobby();
}

function leaveLobby(): void {
  currentRun()?.dispose();
  net?.leave();
  remember(null);
  teardown();
  garage();
}

// ------------------------------------------------------------------ the co-op menu

export async function coopHome(): Promise<void> {
  try {
    net = await Net.shared();
  } catch (e) {
    toast((e as Error).message, 'bad');
    return;
  }
  if (!demoScene()) demoLake({ seed: 99, look: session.profile.look });
  show((root) => {
    const code = h('input', { type: 'text', inputmode: 'numeric', maxlength: '5', placeholder: '0000', style: 'width:170px;font-size:34px;text-align:center;letter-spacing:6px', 'aria-label': 'Lobby code' }) as HTMLInputElement;
    const join = () => void joinLobby(code.value.trim());
    const friends = h('div.col', { style: 'gap:6px' }, h('div.dim', 'Loading friends…'));
    void api
      .friends()
      .then((v: FriendsView) => friends.replaceChildren(...friendRows(v, { onJoin: (c) => void joinLobby(c) })))
      .catch(() => friends.replaceChildren(h('div.dim', 'Couldn’t load friends.')));
    root.appendChild(
      h(
        'div.screen',
        { style: 'align-items:center;justify-content:center;background:rgba(10,14,34,0.45)' },
        h(
          'div.row',
          { style: 'gap:24px;align-items:stretch' },
          h('div.panel.col', { style: 'width:420px' }, h('h2', 'Host a lobby'), h('div', 'Get a code, invite friends, pick house rules, and hit the road. Up to four anglers.'), h('div.grow'), h('button.primary.big', { onclick: () => void hostLobby() }, 'Open a lobby')),
          h('div.panel.col', { style: 'width:420px' }, h('h2', 'Join with a code'), h('div.row', code, h('button.teal', { onclick: join }, 'Join')), keypad(code, join)),
          h('div.panel.col', { style: 'width:420px' }, h('div.row', h('h2.grow', 'Friends'), h('button.tiny', { onclick: () => friendsModal(false, (c) => void joinLobby(c)) }, 'Manage')), h('div.scroll', { style: 'max-height:420px' }, friends)),
        ),
        h('button', { style: 'margin-top:20px', onclick: () => garage() }, '◀ Back to the garage'),
      ),
    );
  });
}

async function hostLobby(): Promise<void> {
  try {
    net = await Net.shared();
    const room = await net.create();
    teardown();
    L = { code: room.code, host: me(), players: [{ ...myInfo(), slot: 0, online: true }], mods: [], inRun: false };
    link = new CoopLink(net, 'host', me());
    remember(room.code, 'host');
    wire();
    lobbyScreen();
    audio.sfx('ready');
  } catch (e) {
    toast((e as Error).message, 'bad');
  }
}

export async function joinLobby(code: string): Promise<void> {
  if (!/^\d{4,6}$/.test(code)) return void toast('Lobby codes are four digits.', 'bad');
  try {
    net = await Net.shared();
    const room = await net.join(code);
    teardown();
    L = { code: room.code, host: room.host, players: [{ ...myInfo(), slot: 1, online: true }], mods: [], inRun: false };
    link = new CoopLink(net, 'guest', me());
    remember(room.code, 'guest');
    wire();
    link.send({ t: 'hello', ...myInfo() });
    lobbyScreen();
    audio.sfx('ready');
  } catch (e) {
    toast((e as Error).message, 'bad');
  }
}

// ------------------------------------------------------------------ messages

function lobbyMsg(): Msg {
  return { t: 'lobby', mods: L!.mods, players: L!.players, host: L!.host };
}

function wire(): void {
  if (!net || !link) return;
  offs.push(
    link.on((m, from) => {
      if (!L) return;
      if (isHost() && from) {
        if (m.t === 'hello') {
          const info = m as unknown as LobbyPlayer;
          let pl = L.players.find((p) => p.id === from);
          if (!pl) {
            const used = new Set(L.players.map((p) => p.slot));
            const slot = [0, 1, 2, 3].find((s) => !used.has(s)) ?? L.players.length;
            pl = { id: from, name: String(info.name || 'Angler').slice(0, 20), look: info.look, dash: (info.dash ?? []).slice(0, 3), slot, online: true, lure: String(info.lure || 'bobber') };
            if (!L.inRun) L.players.push(pl);
          } else {
            pl.look = info.look;
            pl.dash = (info.dash ?? []).slice(0, 3);
            pl.name = String(info.name || pl.name).slice(0, 20);
            pl.online = true;
          }
          if (L.inRun) {
            // they came back mid-run (a refresh): their run is gone, so the run stops waiting for them; they join the next
            currentRun()?.dropPlayer(from);
            link!.send({ t: 'busy', to: from });
          } else link!.send(lobbyMsg());
          rerender?.();
        }
        return;
      }
      if (!isHost()) {
        if (m.t === 'lobby') {
          const mine = L.players.find((p) => p.id === me());
          L.mods = (m.mods as string[]) ?? [];
          L.host = String(m.host || L.host);
          L.players = (m.players as LobbyPlayer[]).map((p) => (p.id === me() && mine ? { ...p, look: mine.look, dash: mine.dash } : p));
          const there = (m.players as LobbyPlayer[]).find((p) => p.id === me());
          if (!there || (!there.dash.length && mine?.dash.length)) link!.send({ t: 'hello', ...myInfo() });
          rerender?.();
        } else if (m.t === 'busy' && m.to === me()) {
          toast('A run is under way. You’ll join the next one when they’re back in the lobby.', 'gold', 6000);
        } else if (m.t === 'start') {
          L.inRun = true;
          const players = m.players as CoopPlayer[];
          if (!players.some((p) => p.id === me())) return;
          startCoop(m.cfg as RunConfig, 'guest', me(), link!, players);
        } else if (m.t === 'lobby-back') {
          currentRun()?.dispose();
          L.inRun = false;
          link!.send({ t: 'hello', ...myInfo() });
          lobbyScreen();
        }
      }
    }),
  );
  offs.push(
    net.on('room', (r: RoomView) => {
      if (!L) return;
      const online = new Set(r.players.filter((p) => p.online).map((p) => p.userId));
      const present = new Set(r.players.map((p) => p.userId));
      if (isHost()) {
        if (!L.inRun) {
          L.players = L.players.filter((p) => present.has(p.id));
          // someone in the room we haven't heard from yet (we came back after a refresh): a seat until they say hello
          for (const rp of r.players) {
            if (L.players.some((p) => p.id === rp.userId)) continue;
            const used = new Set(L.players.map((p) => p.slot));
            const slot = [0, 1, 2, 3].find((s) => !used.has(s)) ?? L.players.length;
            L.players.push({ id: rp.userId, name: rp.name, look: { hat: 0, hatColor: slot, jacket: slot, skin: 1, hair: 0 }, dash: [], slot, online: rp.online, lure: 'bobber' });
          }
        }
        for (const p of L.players) p.online = online.has(p.id);
        if (!L.inRun) link!.send(lobbyMsg());
      }
      currentRun()?.setOnline(online);
      rerender?.();
    }),
  );
  offs.push(
    net.on('closed', (m: { reason: string }) => {
      remember(null);
      const run = currentRun();
      teardown();
      if (run) run.closed(m.reason);
      else {
        toast(m.reason, 'bad', 5000);
        void coopHome();
      }
    }),
  );
  offs.push(net.on('hostaway', () => toast('The host dropped out. Holding their seat for 3 minutes…', 'bad', 5000)));
  offs.push(net.on('hostback', () => toast('The host is back.', 'gold')));
  offs.push(
    net.on('guestleft', (m: { userId: string }) => {
      if (!L || !isHost() || L.inRun) return;
      L.players = L.players.filter((p) => p.id !== m.userId);
      link!.send(lobbyMsg());
      rerender?.();
    }),
  );
}

// ------------------------------------------------------------------ the lobby

function lobbyScreen(): void {
  if (!L) return;
  if (!demoScene()) demoLake({ seed: 99, look: session.profile.look });
  audio.music('menu');
  show((root) => {
    const body = h('div', { style: 'display:contents' });
    const render = () => {
      if (!L) return;
      const seats = [0, 1, 2, 3].map((slot) => L!.players.find((p) => p.slot === slot) ?? null);
      body.replaceChildren(
        h(
          'div.row',
          h('div.panel', { style: 'padding:12px 22px' }, h('div.hud-label', 'Lobby code'), h('div.display', { style: 'font-size:56px;letter-spacing:8px;line-height:1' }, L!.code)),
          h('div.col', { style: 'gap:4px;color:#fff' }, h('h2', 'Fish with friends'), h('div', { style: 'font-weight:600' }, 'Everyone hops in the truck. Same lakes, same bubbles, same clock. Highest score wins.')),
          h('div.grow'),
          h('button', { onclick: () => friendsModal(true, (c) => void joinLobby(c)) }, '👥 Invite friends'),
          h('button.red', { onclick: () => leaveLobby() }, 'Leave'),
        ),
        h(
          'div.row',
          { style: 'gap:16px;align-items:stretch' },
          ...seats.map((pl, i) =>
            h(
              'div.panel.col',
              { style: `flex:1;gap:8px;padding:16px;min-height:300px;border-color:${pl ? 'var(--ink)' : 'rgba(255,255,255,0.4)'};background:${pl ? 'var(--paper)' : 'rgba(255,255,255,0.12)'}` },
              pl
                ? [
                    h('div.row', h('span', { style: `width:20px;height:20px;border-radius:50%;border:3px solid var(--ink);background:${SEAT_COLORS[i]}` }), h('b.grow', { style: 'font-size:22px' }, pl.name), pl.id === L!.host ? h('span.chip.gold', 'Host') : '', pl.online ? '' : h('span.chip.bad', 'away')),
                    h('div.small.dim', `${HATS[pl.look?.hat ?? 0] ?? ''}`),
                    h('div.hud-label', 'Their dash'),
                    h('div.row', { style: 'gap:4px' }, ...[0, 1, 2].map((k) => (pl.dash[k] ? ornPic(pl.dash[k]!, 72, { title: pl.dash[k]!.name }) : h('div', { style: 'width:72px;height:72px;border:3px dashed var(--paper3);border-radius:12px' })))),
                  ]
                : h('div', { style: 'margin:auto;color:#fff;font-weight:700;text-align:center' }, 'Empty seat', h('div.small', 'Share the code or invite a friend')),
            ),
          ),
        ),
        h(
          'div.panel.col',
          { style: 'gap:8px;padding:16px' },
          h('div.row', h('h3.grow', 'House rules'), h('span.small.dim', isHost() ? 'Pick up to three twists (optional).' : 'The host picks these.')),
          h(
            'div.row.wrap',
            { style: 'gap:6px' },
            ...MODS.map((m) => {
              const on = L!.mods.includes(m.id);
              return h(
                `button.tiny${on ? '.on.teal' : ''}`,
                {
                  title: m.text,
                  disabled: !isHost() && !on,
                  onclick: () => {
                    if (!isHost()) return;
                    if (on) L!.mods = L!.mods.filter((x) => x !== m.id);
                    else if (L!.mods.length < 3 && !L!.mods.some((x) => MOD[x]?.excludes?.includes(m.id) || m.excludes?.includes(x))) L!.mods.push(m.id);
                    else return void toast(L!.mods.length >= 3 ? 'Three twists at most.' : 'Those two don’t go together.', 'bad');
                    link!.send(lobbyMsg());
                    render();
                  },
                },
                `${m.glyph} ${m.name}`,
              );
            }),
          ),
          L!.mods.length ? h('div.small', ...L!.mods.map((x) => h('div', h('b', `${MOD[x]!.name}: `), MOD[x]!.text))) : '',
        ),
        h(
          'div.row',
          h('div.grow.small', { style: 'color:#fff' }, 'You’ll each pick your gear at every hole (90 seconds, or when everyone is ready). Each of you shops and keeps your own catches and gear.'),
          isHost() ? h('button.primary.big', { onclick: () => startRun() }, `Hit the road (${L!.players.length} angler${L!.players.length === 1 ? '' : 's'})`) : h('div.panel', { style: 'padding:10px 18px;font-weight:700' }, 'Waiting for the host to start…'),
        ),
      );
    };
    rerender = render;
    render();
    root.appendChild(h('div.screen', { style: 'background:rgba(10,14,34,0.55);gap:18px' }, body));
    return () => {
      if (rerender === render) rerender = null;
    };
  });
}

function startRun(): void {
  if (!L || !isHost() || !link) return;
  L.inRun = true;
  const cfg = buildRun(Math.floor(Math.random() * 2 ** 31), 'coop', L.mods);
  const players: CoopPlayer[] = L.players.map((p) => ({ id: p.id, name: p.name, look: p.look, color: SEAT_COLORS[p.slot] ?? '#fff', slot: p.slot, dash: p.dash, lure: p.lure, score: 0, ready: false, done: false, online: p.online, legend: 0, bubbleRate: 0 }));
  link.send({ t: 'start', cfg, players });
  startCoop(cfg, 'host', me(), link, players);
}

/** the host takes everyone back to the lobby after a run */
export function backToLobby(): void {
  const run: Run | null = currentRun();
  run?.dispose();
  if (!L || !link) return void garage();
  L.inRun = false;
  // only the people still in the room keep their seats
  const present = new Set((net?.room?.players ?? []).map((p) => p.userId));
  L.players = L.players.filter((p) => p.id === me() || present.has(p.id)).map((p) => (p.id === me() ? { ...p, ...myInfo() } : p));
  link.send({ t: 'lobby-back' });
  link.send(lobbyMsg());
  lobbyScreen();
}

// ------------------------------------------------------------------ invites

let listening = false;

export function listenInvites(): void {
  if (listening || !session.online) return;
  listening = true;
  void Net.shared()
    .then((n) => {
      n.on('invite', (m: { fromName: string; code: string; game: string; gameName?: string }) => {
        if (m.game !== 'sak') return toast(`${m.fromName} invited you to ${m.gameName ?? 'a game'} (code ${m.code}).`, 'gold', 6000);
        if (L) return toast(`${m.fromName} invited you to their lobby (${m.code}).`, 'gold', 6000);
        audio.sfx('ready');
        const close = modal(h('div.col', { style: 'width:460px;text-align:center;align-items:center' }, h('h2', 'Fishing invite!'), h('div', { style: 'font-size:20px' }, `${m.fromName} wants you in the truck.`), h('div.row', h('button', { onclick: () => close() }, 'Not now'), h('button.primary', { onclick: () => (close(), void joinLobby(m.code)) }, 'Join'))));
      });
      // after a refresh, take our place in the lobby again
      try {
        const saved = JSON.parse(sessionStorage.getItem(ROOM_KEY) || 'null') as { code: string; role: 'host' | 'guest' } | null;
        if (saved?.code && !L) {
          if (saved.role === 'guest') void joinLobby(saved.code);
          else
            void n
              .reclaim(saved.code)
              .then((room) => {
                teardown();
                // everyone still in the room gets their seat back (their looks arrive with their hello)
                const others = room.players.filter((p) => p.userId !== me());
                L = {
                  code: room.code,
                  host: me(),
                  players: [{ ...myInfo(), slot: 0, online: true }, ...others.slice(0, 3).map((p, i) => ({ id: p.userId, name: p.name, look: { hat: 0, hatColor: i + 1, jacket: i + 1, skin: 1, hair: 0 }, dash: [], slot: i + 1, online: p.online, lure: 'bobber' }))],
                  mods: [],
                  inRun: false,
                };
                link = new CoopLink(n, 'host', me());
                wire();
                // a run the host was in is gone: call everyone back to the lobby
                link.send({ t: 'lobby-back' });
                link.send(lobbyMsg());
                lobbyScreen();
              })
              .catch(() => remember(null));
        }
      } catch {
        /* nothing saved */
      }
    })
    .catch(() => {
      listening = false;
    });
}

export function checkInvites(): void {
  listenInvites();
}
