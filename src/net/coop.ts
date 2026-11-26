// The co-op link over Shoallhell's relay: the host's messages go to every guest; a guest's go to the host only
// (the host passes on what the others need, like each angler's picture on the lake).
import type { Net } from './socket';

export type Msg = Record<string, unknown> & { t: string };

export class CoopLink {
  constructor(
    public net: Net,
    public role: 'host' | 'guest',
    public me: string,
  ) {}

  send(msg: Record<string, unknown>): void {
    if (this.role === 'host') this.net.hostSend(msg);
    else this.net.guestSend(msg);
  }

  on(fn: (msg: Msg, from?: string) => void): () => void {
    if (this.role === 'host') return this.net.on('guestmsg', (m: { from: string; msg: Msg }) => m?.msg && fn(m.msg, m.from));
    return this.net.on('hostmsg', (m: Msg) => m && fn(m));
  }
}
