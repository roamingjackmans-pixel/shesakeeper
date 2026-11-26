// The shell: one canvas, one DOM layer on top, and the screen currently shown. Boot shows the title over a live
// fishing hole, signs you back in, and opens the garage.
import { audio } from './audio/audio';
import { GAME_VERSION } from './version';
import { mountCanvas } from './render/canvas';
import { restore, session, playOffline, signIn, signUp } from './session';
import { demoLake } from './ui/demo';
import { closeModals, h, stage, toast } from './ui/dom';
import { garage } from './ui/garage';
import { checkInvites } from './ui/lobby';

let cleanup: (() => void) | null = null;

export function ui(): HTMLElement {
  return document.getElementById('ui')!;
}

/** replace the screen; `build` may return a cleanup for when the next screen comes */
export function show(build: (root: HTMLElement) => void | (() => void)): void {
  const c = cleanup;
  cleanup = null;
  c?.();
  const root = ui();
  for (const el of [...root.children]) if (el.id !== 'toasts') el.remove();
  closeModals();
  const r = build(root);
  if (typeof r === 'function') cleanup = r;
}

export async function boot(): Promise<void> {
  mountCanvas(stage());
  demoLake({ seed: Math.floor(Math.random() * 1e6) });
  audio.music('menu');
  audio.ambience({ water: true, birds: true });
  let state: 'online' | 'offline' | 'none' = 'none';
  try {
    state = await restore();
  } catch (e) {
    toast((e as Error).message, 'bad', 5000);
  }
  titleScreen(state !== 'none');
  // signed in: hear invites, and if this tab was in a lobby before a refresh, go straight back to it
  if (state === 'online') checkInvites();
}

export function titleScreen(signedIn: boolean): void {
  show((root) => {
    const play = h('button.primary.big', { style: 'font-size:38px;padding:16px 56px', onclick: () => (audio.sfx('click'), signedIn ? garage() : authScreen()) }, signedIn ? 'Go fishing' : 'Play');
    root.appendChild(
      h(
        'div.screen',
        { style: 'align-items:center;justify-content:center;background:linear-gradient(180deg,rgba(10,14,34,0.35),rgba(10,14,34,0) 40%,rgba(10,14,34,0.25))' },
        h('div', { style: 'height:40px' }),
        h('div.logo.center', { style: 'animation:pop .5s cubic-bezier(.2,1.5,.5,1)' }, 'She’s A', h('br'), h('span.gold', 'Keeper')),
        h('div.tagline.center', 'Cast into the bubbles. Reel them in. Chase the legend.'),
        h('div', { style: 'height:10px' }),
        play,
        signedIn ? h('div.tagline', { style: 'font-size:18px' }, session.online ? `Signed in as ${session.user?.name}` : 'Playing offline on this device') : '',
        h('div', { style: 'position:absolute;bottom:14px;right:20px;color:rgba(255,255,255,0.7);font-size:14px' }, `v${GAME_VERSION}`),
      ),
    );
    const key = (e: KeyboardEvent): void => {
      if (e.code === 'Enter' || e.code === 'Space') play.click();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
}

export function authScreen(): void {
  show((root) => {
    let mode: 'in' | 'up' = 'in';
    const email = h('input', { type: 'email', placeholder: 'Email', autocomplete: 'email', 'aria-label': 'Email' }) as HTMLInputElement;
    const pass = h('input', { type: 'password', placeholder: 'Password (8+ characters)', autocomplete: 'current-password', 'aria-label': 'Password' }) as HTMLInputElement;
    const name = h('input', { type: 'text', placeholder: 'Angler name', maxlength: '20', 'aria-label': 'Angler name' }) as HTMLInputElement;
    const err = h('div', { style: 'color:#c0303a;font-weight:700;min-height:24px' });
    const go = h('button.primary.big', { type: 'submit' }, 'Sign in') as HTMLButtonElement;
    const swap = h('button.ghost', { type: 'button', style: 'color:var(--ink);border-color:var(--ink)' }, 'New here? Make an account');
    const nameRow = h('div', { style: 'display:none' }, name);
    const form = h(
      'form.col',
      {
        onsubmit: async (e: Event) => {
          e.preventDefault();
          err.textContent = '';
          go.disabled = true;
          try {
            if (mode === 'in') await signIn(email.value.trim(), pass.value);
            else await signUp(email.value.trim(), pass.value, name.value.trim());
            audio.sfx('catch');
            toast(`Welcome${mode === 'up' ? '' : ' back'}, ${session.user?.name}!`, 'gold');
            garage();
          } catch (x) {
            err.textContent = (x as Error).message;
            audio.sfx('bad');
          } finally {
            go.disabled = false;
          }
        },
      },
      h('h2', 'Sign in'),
      h('div.small.dim', 'The same account as Shoallhell, Smash Your Bros and Baker’s Dozen. Your gear, ornaments and fish log are saved to it, and you can fish with friends.'),
      email,
      pass,
      nameRow,
      err,
      go,
      swap,
    );
    swap.addEventListener('click', () => {
      mode = mode === 'in' ? 'up' : 'in';
      (form.querySelector('h2') as HTMLElement).textContent = mode === 'in' ? 'Sign in' : 'Make an account';
      go.textContent = mode === 'in' ? 'Sign in' : 'Create account';
      swap.textContent = mode === 'in' ? 'New here? Make an account' : 'Have an account? Sign in';
      nameRow.style.display = mode === 'up' ? '' : 'none';
      pass.autocomplete = mode === 'up' ? 'new-password' : 'current-password';
    });
    root.appendChild(
      h(
        'div.screen',
        { style: 'align-items:center;justify-content:center' },
        h(
          'div.panel',
          { style: 'width:520px' },
          form,
          h('hr', { style: 'border:none;border-top:3px dashed var(--paper3);margin:18px 0' }),
          h(
            'div.row',
            h('button', { type: 'button', onclick: () => titleScreen(false) }, '◀ Back'),
            h('div.grow'),
            h('button.teal', { type: 'button', onclick: () => (playOffline(), garage()) }, 'Play offline'),
          ),
          h('div.small.dim', { style: 'margin-top:8px' }, 'Offline saves stay in this browser. Online play needs an account.'),
        ),
      ),
    );
    setTimeout(() => email.focus(), 50);
  });
}
