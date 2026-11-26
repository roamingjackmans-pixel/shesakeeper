// Who is playing and their save. Signed in, the save lives on Shoallhell's server (shared accounts) and is written a
// moment after anything changes; "play offline" keeps it in this browser instead.
import { cleanProfile, newProfile, type Profile } from './core/profile';
import type { Ornament } from './core/ornament';
import { api, ApiError, getToken, setToken, type User } from './net/api';
import { Net } from './net/socket';
import { audio } from './audio/audio';

const OFFLINE_KEY = 'sak.offline';
const OFFLINE_MODE = 'sak.offlineMode';

export const session = {
  online: false,
  /** playing offline: the save lives in this browser */
  offline: false,
  user: null as User | null,
  profile: newProfile(),
  rev: 0,
  saving: false,
};

function ls(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function applySettings(): void {
  audio.setVolumes(session.profile.settings.sfx, session.profile.settings.music);
}

export async function restore(): Promise<'online' | 'offline' | 'none'> {
  if (getToken()) {
    try {
      const r = await api.me();
      session.online = true;
      session.user = r.user;
      session.profile = cleanProfile(r.profile);
      session.rev = r.rev;
      applySettings();
      return 'online';
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setToken('');
      else if (ls()?.getItem(OFFLINE_MODE) !== '1') throw e;
    }
  }
  if (ls()?.getItem(OFFLINE_MODE) === '1') {
    playOffline();
    return 'offline';
  }
  return 'none';
}

export function playOffline(): void {
  session.online = false;
  session.offline = true;
  session.user = null;
  let raw: unknown = null;
  try {
    raw = JSON.parse(ls()?.getItem(OFFLINE_KEY) || 'null');
  } catch {
    raw = null;
  }
  session.profile = cleanProfile(raw);
  ls()?.setItem(OFFLINE_MODE, '1');
  applySettings();
}

async function adopt(token: string, user: User): Promise<void> {
  setToken(token);
  ls()?.removeItem(OFFLINE_MODE);
  session.online = true;
  session.offline = false;
  session.user = user;
  const r = await api.me();
  session.profile = cleanProfile(r.profile);
  session.rev = r.rev;
  if (!r.profile) await saveNow();
  applySettings();
}

export async function signIn(email: string, password: string): Promise<void> {
  const r = await api.login(email, password);
  await adopt(r.token, r.user);
}

export async function signUp(email: string, password: string, name: string): Promise<void> {
  const r = await api.signup(email, password, name);
  await adopt(r.token, r.user);
}

export async function signOut(): Promise<void> {
  if (session.online) await saveNow().catch(() => {});
  try {
    if (session.online) await api.logout();
  } catch {
    /* already gone */
  }
  setToken('');
  await Net.drop();
  session.online = false;
  session.offline = false;
  session.user = null;
  session.profile = newProfile();
  ls()?.removeItem(OFFLINE_MODE);
}

export function displayName(): string {
  return session.user?.name ?? 'You';
}

/** two copies of a save from two devices, merged so nothing anyone earned is lost */
export function mergeProfiles(server: Profile, local: Profile): Profile {
  const p = cleanProfile(server);
  p.owned = [...new Set([...p.owned, ...local.owned])];
  const ids = new Set(p.ornaments.map((o) => o.id));
  const sameOrn = (a: Ornament, b: Ornament) => a.type === b.type && JSON.stringify(a.perks) === JSON.stringify(b.perks);
  p.nextOrn = Math.max(p.nextOrn, local.nextOrn);
  for (const o of local.ornaments) {
    const there = p.ornaments.find((x) => x.id === o.id);
    if (there && sameOrn(there, o)) continue;
    if (p.ornaments.length >= 60) break;
    const copy = { ...o, id: ids.has(o.id) ? `o${p.nextOrn++}` : o.id };
    ids.add(copy.id);
    p.ornaments.push(copy);
  }
  for (const [id, e] of Object.entries(local.log)) {
    const s = p.log[id];
    p.log[id] = s ? { n: Math.max(s.n, e.n), best: Math.max(s.best, e.best), bestKg: Math.max(s.bestKg, e.bestKg), at: Math.min(s.at || e.at, e.at || s.at) } : e;
  }
  for (const k of Object.keys(p.stats) as (keyof Profile['stats'])[]) p.stats[k] = Math.max(p.stats[k], local.stats[k]);
  if (local.daily.date >= p.daily.date) p.daily = { ...local.daily, best: local.daily.date === p.daily.date ? Math.max(local.daily.best, p.daily.best) : local.daily.best, reward: local.daily.reward || (local.daily.date === p.daily.date && p.daily.reward) };
  p.loadout = local.loadout;
  p.look = local.look;
  p.settings = local.settings;
  p.tips = [...new Set([...p.tips, ...local.tips])];
  p.history = [...local.history, ...p.history].sort((a, b) => b.at - a.at).filter((h, i, all) => all.findIndex((x) => x.at === h.at) === i).slice(0, 10);
  return cleanProfile(p);
}

let timer = 0;
let chain: Promise<void> = Promise.resolve();

export function saveSoon(): void {
  if (!session.online) {
    // nobody signed in and not playing offline (the title screen): nothing to save
    if (!session.offline) return;
    try {
      ls()?.setItem(OFFLINE_KEY, JSON.stringify(session.profile));
    } catch {
      /* full or private */
    }
    return;
  }
  clearTimeout(timer);
  timer = window.setTimeout(() => void saveNow().catch(() => {}), 1200);
}

export function saveNow(): Promise<void> {
  clearTimeout(timer);
  if (!session.online) {
    saveSoon();
    return Promise.resolve();
  }
  chain = chain.then(async () => {
    session.saving = true;
    try {
      const r = await api.save(session.profile, session.rev);
      session.rev = r.rev;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const body = e.body as { rev?: number; profile?: unknown };
        session.profile = mergeProfiles(cleanProfile(body.profile), session.profile);
        session.rev = Number(body.rev) || session.rev;
        const r = await api.save(session.profile, session.rev);
        session.rev = r.rev;
      } else throw e;
    } finally {
      session.saving = false;
    }
  });
  return chain;
}

window.addEventListener('beforeunload', () => {
  if (session.offline) saveSoon();
});
