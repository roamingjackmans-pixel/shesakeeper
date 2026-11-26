// Friends (shared with Shoallhell, Smash Your Bros and Baker's Dozen): your friend code, requests, who's online and
// where, invites from a lobby, and joining a friend's lobby straight from the list.
import { api, type FriendsView } from '../net/api';
import { Net } from '../net/socket';
import { audio } from '../audio/audio';
import { h, keypad, modal, toast } from './dom';

const GAME_NAMES: Record<string, string> = { sak: 'She’s A Keeper', bd: 'Baker’s Dozen', shoallhell: 'Shoallhell', syb: 'Smash Your Bros' };

export function whereText(f: FriendsView['friends'][number]): string {
  if (!f.online) return 'offline';
  const g = GAME_NAMES[f.game ?? ''] ?? 'a game';
  if (f.game === 'sak') return f.lobby ? `in a fishing lobby (${f.lobby})` : 'fishing';
  return f.lobby ? `in a ${g} lobby` : `playing ${g}`;
}

export function friendRows(v: FriendsView, opts: { invite?: boolean; onJoin?: (code: string) => void; close?: () => void } = {}): HTMLElement[] {
  const sorted = [...v.friends].sort((a, b) => Number(!!b.online) - Number(!!a.online) || a.name.localeCompare(b.name));
  if (!sorted.length) return [h('div.small.dim', 'No friends yet. Swap 4-digit friend codes (your friends from the other games show up here too).')];
  return sorted.map((f) =>
    h(
      'div.row',
      { style: 'padding:6px 10px;border-radius:12px;background:rgba(0,0,0,0.06)' },
      h('span', { style: `color:${f.online ? '#3aa05a' : '#9a8a7a'};font-size:18px` }, '●'),
      h('div.grow', h('b', f.name), h('div.small.dim', whereText(f))),
      opts.invite && f.online
        ? h(
            'button.tiny.primary',
            {
              onclick: async () => {
                try {
                  const net = await Net.shared();
                  await net.invite(f.id);
                  toast(`Invited ${f.name}.`);
                  audio.sfx('ready');
                } catch (e) {
                  toast((e as Error).message, 'bad');
                }
              },
            },
            'Invite',
          )
        : '',
      !opts.invite && f.lobby && f.game === 'sak' && opts.onJoin ? h('button.tiny.gold', { onclick: () => (opts.close?.(), opts.onJoin!(f.lobby!)) }, 'Join') : '',
    ),
  );
}

export function friendsModal(inLobby = false, onJoin?: (code: string) => void): void {
  const body = h('div.col');
  const close = modal(h('div.col', { style: 'width:580px' }, h('div.row', h('h2.grow', 'Friends'), h('button', { onclick: () => close() }, 'Close')), body));
  let off: (() => void) | null = null;
  void Net.shared()
    .then((n) => (off = n.on('friends', () => void render())))
    .catch(() => {});
  const render = async (): Promise<void> => {
    if (!body.isConnected && off) {
      off();
      return;
    }
    let v: FriendsView;
    try {
      v = await api.friends();
    } catch (e) {
      body.replaceChildren(h('div', { style: 'color:#c0303a;font-weight:700' }, (e as Error).message));
      return;
    }
    const code = h('input', { type: 'text', placeholder: 'Their friend code', maxlength: '5', inputmode: 'numeric', style: 'width:200px', 'aria-label': 'Friend code' }) as HTMLInputElement;
    const add = async (): Promise<void> => {
      try {
        const r = await api.addFriend(code.value.trim());
        toast(r.friends ? 'You’re friends now.' : 'Request sent. They’ll see it next time they play.');
        void render();
      } catch (e) {
        toast((e as Error).message, 'bad');
      }
    };
    body.replaceChildren(
      h('div.row', h('span', 'Your friend code:'), h('b.display', { style: 'font-size:32px;letter-spacing:4px' }, v.code)),
      h('div.row', code, h('button.primary', { onclick: () => void add() }, 'Add friend')),
      keypad(code, () => void add()),
      v.incoming.length ? h('h3', 'Requests') : '',
      ...v.incoming.map((f) => h('div.row', h('b.grow', f.name), h('button.tiny.primary', { onclick: () => void api.acceptFriend(f.id).then(() => render()) }, 'Accept'), h('button.tiny', { onclick: () => void api.removeFriend(f.id).then(() => render()) }, 'Decline'))),
      h('h3', `Friends (${v.friends.length})`),
      ...friendRows(v, { invite: inLobby, onJoin, close }),
      v.outgoing.length ? h('h3', 'Waiting for them') : '',
      ...v.outgoing.map((f) => h('div.row', h('span.grow', f.name), h('button.tiny', { onclick: () => void api.removeFriend(f.id).then(() => render()) }, 'Cancel'))),
    );
  };
  void render();
}
