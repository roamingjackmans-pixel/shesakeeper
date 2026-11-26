// Shared pieces of the menus: ornament cards (perks in green, curses in red under the perk that brought them, and the
// range each value rolled in), gear cards, charm badges, and the numbers your loadout adds up to.
import { ornamentPrice, perkRange, perkText, type Ornament } from '../core/ornament';
import { BASE, derived, describeBonus, type Stats } from '../core/stats';
import { CHARM } from '../data/charms';
import { GEAR, KIND_NAME } from '../data/gear';
import { ORN_TYPES, TIERS } from '../data/perks';
import { gearImage } from '../render/gearart';
import { ornamentImage } from '../render/ornart';
import { h } from './dom';

export function perkLines(o: Ornament, ranges = true): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const p of o.perks) {
    out.push(h('div.perk', h('span.pip', '▲'), h('span', perkText(p.k, p.v)), ranges ? h('span.range', perkRange(p.k)) : ''));
    if (p.c) out.push(h('div.perk.curse', h('span.pip', '▼'), h('span', perkText(p.c.k, p.c.v)), ranges ? h('span.range', perkRange(p.c.k, true)) : ''));
  }
  return out;
}

export function tierBand(o: Ornament): HTMLElement {
  return h(`span.tierband.tier-${o.tier}`, TIERS[o.tier].name);
}

export function ornCard(o: Ornament, opts: { price?: number; extra?: (HTMLElement | string)[]; compact?: boolean } = {}): HTMLElement {
  return h(
    `div.card.tier-${o.tier}`,
    { style: `display:flex;gap:12px;align-items:flex-start;border-color:var(--ink);background:linear-gradient(180deg,#fff,#fff 70%,color-mix(in srgb,var(--tc) 35%,#fff))` },
    h('img', { src: ornamentImage(o, 96), alt: '', style: `width:${opts.compact ? 72 : 96}px;height:${opts.compact ? 72 : 96}px;flex:none` }),
    h(
      'div.col',
      { style: 'gap:4px;min-width:0' },
      h('div.row', { style: 'gap:8px' }, h('b', { style: 'font-size:19px;line-height:1.1' }, o.name), o.fav ? h('span', { title: 'Kept' }, '★') : ''),
      h('div.row', { style: 'gap:6px' }, tierBand(o), h('span.small.dim', ORN_TYPES[o.type].name)),
      ...perkLines(o),
      opts.price !== undefined ? h('div.small.dim', `Worth about $${ornamentPrice(o)}`) : '',
      ...(opts.extra ?? []),
    ),
  );
}

export function gearCard(id: string, opts: { owned?: boolean; price?: number } = {}): HTMLElement {
  const g = GEAR[id]!;
  return h(
    'div.card',
    { style: 'display:flex;gap:12px;align-items:flex-start' },
    h('img', { src: gearImage(id, 80), alt: '', style: 'width:84px;height:84px;flex:none' }),
    h(
      'div.col',
      { style: 'gap:4px' },
      h('b', { style: 'font-size:19px' }, g.name),
      h('span.small.dim', `${KIND_NAME[g.kind]} · ${g.blurb}`),
      ...describeBonus(g.bonus).map((t) => h('div.perk', h('span.pip', '▲'), t)),
      !describeBonus(g.bonus).length ? h('div.small.dim', 'No bonuses. Honest gear.') : '',
      g.special && !opts.owned ? h('div.small', { style: 'font-weight:700;color:#a06a10' }, g.special) : '',
      opts.price !== undefined ? h('div.cash', `$${opts.price}`) : '',
    ),
  );
}

export function charmIcon(id: string, small = false): HTMLElement {
  const c = CHARM[id];
  return h(`div.charm-icon${small ? '.sm' : ''}`, { style: `background:${c?.color ?? '#888'}`, title: c ? `${c.name}: ${c.text}` : '' }, c?.glyph ?? '?');
}

export function charmCard(id: string): HTMLElement {
  const c = CHARM[id]!;
  return h('div.card', { style: 'display:flex;gap:12px;align-items:center' }, charmIcon(id), h('div.col', { style: 'gap:2px' }, h('b', { style: 'font-size:19px' }, c.name), h('span', c.text), h('span.small.dim', 'Run charm: lasts until the run ends.')));
}

/** the handful of numbers that matter, compared with bare hands */
export function statSummary(st: Stats): HTMLElement {
  const d = derived(st);
  const pct = (v: number, base: number) => {
    const p = Math.round((v / base - 1) * 100);
    return p === 0 ? '' : `${p > 0 ? '+' : ''}${p}%`;
  };
  const row = (label: string, value: string, delta: string, good: boolean) =>
    h('div.row', { style: 'gap:6px;justify-content:space-between;font-size:16px' }, h('span.dim', label), h('b', value, delta ? h('span', { style: `margin-left:6px;color:${good ? '#2a9a4a' : '#c0303a'};font-size:14px` }, delta) : ''));
  const bar = d.bar / BASE.bar;
  return h(
    'div.col',
    { style: 'gap:4px' },
    row('Catch bar', `${Math.round(d.bar * 100)}%`, pct(d.bar, BASE.bar), bar >= 1),
    row('Cast range', `${Math.round(d.castMax)} m`, pct(d.castMax, BASE.castMax), d.castMax >= BASE.castMax),
    row('Reel speed', `${d.fill.toFixed(2)}/s`, pct(d.fill, BASE.fill), d.fill >= BASE.fill),
    row('Bite wait', `×${d.biteMul.toFixed(2)}`, '', d.biteMul <= 1),
    row('Treasure', `${Math.round(d.treasure * 100)}%`, '', true),
    row('Her chance', `${Math.round(d.legend * 100)}%`, '', true),
  );
}

export function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

export function pts(n: number): string {
  return Math.round(n).toLocaleString();
}
