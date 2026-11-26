// The bait & tackle stop. On the road between holes it sells gear, dash ornaments and run charms; on the way home it
// sells gear and ornaments (spend it: cash doesn't carry over to the next run). Rerolls get dearer each time.
// Sell ornaments you don't need for cash.
import { show } from '../app';
import { audio } from '../audio/audio';
import { ornamentSellValue } from '../core/ornament';
import { GLOVEBOX_MAX, newOrnamentId, removeOrnament } from '../core/profile';
import { Rng, hash } from '../core/rng';
import { isHomeShop } from '../core/run';
import { newShop, rerollCost, rollItems, type ShopItem, type ShopState } from '../core/shop';
import { CHARM, CHARM_SLOTS } from '../data/charms';
import { GEAR, KIND_NAME } from '../data/gear';
import { describeBonus } from '../core/stats';
import { layer, pixelRatio, setScene, type Scene } from '../render/canvas';
import { INK } from '../render/fishart';
import { gearImage } from '../render/gearart';
import { ornamentImage } from '../render/ornart';
import { saveSoon, session } from '../session';
import { h, modal, toast } from './dom';
import type { Run } from './runner';
import { charmIcon, money, ornCard, perkLines, pts, tierBand } from './widgets';

class ShopScene implements Scene {
  private bg: HTMLCanvasElement | null = null;
  resize(): void {
    this.bg = null;
  }
  draw(c: CanvasRenderingContext2D, _dt: number, now: number): void {
    if (!this.bg)
      this.bg = layer(1600, 900, (x) => {
        const g = x.createLinearGradient(0, 0, 0, 600);
        g.addColorStop(0, '#2a2a5e');
        g.addColorStop(0.6, '#c4567a');
        g.addColorStop(1, '#ff9e52');
        x.fillStyle = g;
        x.fillRect(0, 0, 1600, 640);
        x.fillStyle = '#3a4a3a';
        x.fillRect(0, 600, 1600, 300);
        x.fillStyle = '#4a4a50';
        x.fillRect(0, 700, 1600, 200);
        // the shack
        x.fillStyle = '#8a5a3a';
        x.strokeStyle = INK;
        x.lineWidth = 6;
        x.beginPath();
        x.rect(300, 250, 1000, 390);
        x.fill();
        x.stroke();
        x.fillStyle = '#5a3a2a';
        x.beginPath();
        x.moveTo(260, 260);
        x.lineTo(800, 120);
        x.lineTo(1340, 260);
        x.closePath();
        x.fill();
        x.stroke();
        x.strokeStyle = 'rgba(0,0,0,0.25)';
        x.lineWidth = 3;
        for (let y = 280; y < 640; y += 26) {
          x.beginPath();
          x.moveTo(300, y);
          x.lineTo(1300, y);
          x.stroke();
        }
        x.fillStyle = '#ffd890';
        x.strokeStyle = INK;
        x.lineWidth = 5;
        x.fillRect(380, 430, 220, 150);
        x.strokeRect(380, 430, 220, 150);
        x.fillRect(1000, 430, 220, 150);
        x.strokeRect(1000, 430, 220, 150);
        x.fillStyle = '#4a2a1a';
        x.fillRect(720, 450, 160, 190);
        x.strokeRect(720, 450, 160, 190);
      });
    const pr = pixelRatio();
    c.drawImage(this.bg, 0, 0, this.bg.width / pr, this.bg.height / pr);
    // the neon sign
    const on = Math.sin(now * 3) > -0.8;
    c.font = '900 64px "Lilita One", sans-serif';
    c.textAlign = 'center';
    c.lineWidth = 8;
    c.strokeStyle = INK;
    c.strokeText('BAIT & TACKLE', 800, 232);
    c.fillStyle = on ? '#7cf0ff' : '#3a6a7a';
    c.fillText('BAIT & TACKLE', 800, 232);
    // string lights
    for (let i = 0; i < 22; i++) {
      const x = 300 + i * 47.6;
      const y = 262 + Math.sin(i * 0.9) * 6;
      c.fillStyle = ['#ffd23a', '#ff6a5a', '#7cff9a', '#6ab0ff'][i % 4]!;
      c.globalAlpha = 0.6 + 0.4 * Math.sin(now * 2 + i);
      c.beginPath();
      c.arc(x, y, 7, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }
}

let shopFor: { run: Run; visit: number; st: ShopState } | null = null;

export function shopScreen(run: Run): void {
  setScene(new ShopScene());
  audio.music('shop');
  audio.ambience({ crickets: true });
  const p = session.profile;
  const home = isHomeShop(run.st);
  const visit = run.st.shopVisit;
  const ornId = () => newOrnamentId(p);
  if (!shopFor || shopFor.run !== run || shopFor.visit !== visit) {
    const rng = new Rng(hash(`${run.st.cfg.seed}:shop:${visit}:${run.me}`));
    const stats = run.stats();
    shopFor = { run, visit, st: newShop(rng, { owned: p.owned, charms: run.st.charms, home, stats, ornId }) };
    // Piggy Bank interest
    if (run.st.charms.includes('piggy')) {
      const [rate, cap] = CHARM.piggy!.interest!;
      const gain = Math.min(cap, Math.round(run.st.cash * rate));
      if (gain > 0) {
        run.st.cash += gain;
        setTimeout(() => toast(`Piggy Bank: +$${gain} interest`, 'gold'), 400);
      }
    }
  }
  const shop = shopFor.st;
  let rerollRng = new Rng(hash(`${run.st.cfg.seed}:reroll:${visit}:${run.me}:${shop.rerolls}`));
  show((root) => {
    const body = h('div.col', { style: 'gap:14px;flex:1' });
    const timerText = h('b');
    const tick = window.setInterval(() => {
      if (!run.deadline) return;
      const s = Math.max(0, Math.ceil((run.deadline - Date.now()) / 1000));
      if (timerText.textContent !== `${s}s`) timerText.textContent = `${s}s`;
    }, 250);
    const buy = (it: ShopItem) => {
      if (it.sold || run.st.cash < it.price) return;
      if (it.kind === 'ornament' && p.ornaments.length >= GLOVEBOX_MAX) return toast('Your glovebox is full. Sell an ornament first.', 'bad');
      run.st.cash -= it.price;
      it.sold = true;
      if (it.kind === 'gear') {
        p.owned.push(it.id);
        toast(`${GEAR[it.id]!.name} is yours for good.`, 'gold');
      } else if (it.kind === 'ornament' && it.orn) {
        p.ornaments.push(it.orn);
        run.st.found.push(it.orn.id);
        toast(`${it.orn.name} went in the glovebox.`, 'gold');
      } else if (it.kind === 'charm') {
        run.st.charms.push(it.id);
        if (run.st.loadout.charms.length < CHARM_SLOTS) run.st.loadout.charms.push(it.id);
        toast(`${CHARM[it.id]!.name}: on for the rest of the run.`, 'gold');
      }
      audio.sfx('buy');
      saveSoon();
      run.sendStatus(true);
      render();
    };
    const reroll = () => {
      const stats = run.stats();
      const free = shop.freeLeft > 0;
      const cost = free ? 0 : rerollCost(shop.rerolls, stats);
      if (run.st.cash < cost) return;
      run.st.cash -= cost;
      if (free) shop.freeLeft--;
      else shop.rerolls++;
      rerollRng = new Rng(hash(`${run.st.cfg.seed}:reroll:${visit}:${run.me}:${shop.rerolls}:${shop.freeLeft}`));
      shop.items = rollItems(rerollRng, { owned: p.owned, charms: run.st.charms, home, stats, ornId });
      audio.sfx('reroll');
      render();
    };
    const sell = () => {
      const stats = run.stats();
      const list = [...p.ornaments].sort((a, b) => a.perks.length - b.perks.length);
      const box = h('div.grid.scroll', { style: 'grid-template-columns:repeat(2,1fr);max-height:620px;padding:4px 10px 10px 4px' });
      const fill = () =>
        box.replaceChildren(
          ...list
            .filter((o) => p.ornaments.includes(o))
            .map((o) => {
              const onDash = run.st.loadout.dash.includes(o.id);
              const v = ornamentSellValue(o, stats.sellBonus);
              return ornCard(o, {
                compact: true,
                extra: [
                  o.fav
                    ? h('span.chip', '★ Kept (unkeep it in the glovebox to sell)')
                    : h(
                        'button.tiny.gold',
                        {
                          onclick: () => {
                            removeOrnament(p, o.id);
                            run.st.loadout.dash = run.st.loadout.dash.map((d) => (d === o.id ? null : d));
                            run.st.cash += v;
                            audio.sfx('cash');
                            saveSoon();
                            fill();
                            render();
                          },
                        },
                        `Sell for $${v}${onDash ? ' (on your dash!)' : ''}`,
                      ),
                ],
              });
            }),
        );
      fill();
      const close = modal(h('div.col', { style: 'width:1040px' }, h('div.row', h('h2.grow', 'Sell ornaments'), h('button', { onclick: () => close() }, 'Done')), box), { wide: true });
    };
    const card = (it: ShopItem, i: number) => {
      const can = !it.sold && run.st.cash >= it.price && !(it.kind === 'ornament' && p.ornaments.length >= GLOVEBOX_MAX);
      let img: HTMLElement;
      let name = '';
      let kind = '';
      let lines: HTMLElement[] = [];
      if (it.kind === 'gear') {
        const g = GEAR[it.id]!;
        img = h('img', { src: gearImage(it.id, 110) });
        name = g.name;
        kind = `${KIND_NAME[g.kind]} · kept forever`;
        lines = [h('div.small.dim', g.blurb), ...describeBonus(g.bonus).map((t) => h('div.perk', h('span.pip', '▲'), t))];
      } else if (it.kind === 'ornament') {
        const o = it.orn!;
        img = h('img', { src: ornamentImage(o, 110) });
        name = o.name;
        kind = 'Dash ornament';
        lines = [h('div.row', { style: 'gap:6px;justify-content:center' }, tierBand(o)), ...perkLines(o, false)];
      } else {
        const c = CHARM[it.id]!;
        img = charmIcon(it.id);
        name = c.name;
        kind = 'Run charm';
        lines = [h('div', { style: 'font-weight:600;text-align:center' }, c.text)];
      }
      return h(
        `div.shopcard${it.sold ? '.sold' : ''}`,
        { style: `animation-delay:${i * 0.05}s` },
        h('div.kind', kind),
        img,
        h('div.nm', name),
        h('div.col', { style: 'gap:2px;align-self:stretch;flex:1' }, ...lines),
        h(`button${can ? '.primary' : ''}`, { disabled: !can, style: 'align-self:stretch', onclick: () => buy(it) }, it.sold ? 'Sold' : `Buy $${it.price}`),
      );
    };
    const render = () => {
      const stats = run.stats();
      const me = run.myPlayer();
      const cost = shop.freeLeft > 0 ? 0 : rerollCost(shop.rerolls, stats);
      body.replaceChildren(
        h(
          'div.row',
          h('div.panel', { style: 'padding:12px 20px' }, h('div.hud-label', home ? 'Last stop on the way home' : 'On the road'), h('h2', { style: 'font-size:36px' }, 'Bait & Tackle')),
          h('div.grow'),
          h('div.panel.row', { style: 'padding:12px 20px;gap:22px' }, h('div', h('div.hud-label', 'Cash'), h('div.cash', { style: 'font-size:40px' }, money(run.st.cash))), h('div', h('div.hud-label', 'Score'), h('div.display', { style: 'font-size:34px' }, pts(run.st.score)))),
        ),
        h('div.row', { style: 'justify-content:center;gap:14px;align-items:stretch;margin-top:110px' }, ...shop.items.map(card)),
        h(
          'div.row',
          { style: 'justify-content:center;gap:14px' },
          h('button.gold', { disabled: run.st.cash < cost, onclick: reroll }, shop.freeLeft > 0 ? `🎲 Reroll (free ×${shop.freeLeft})` : `🎲 Reroll $${cost}`),
          h('button', { onclick: sell }, `💰 Sell ornaments (${p.ornaments.length}/${GLOVEBOX_MAX})`),
          run.st.charms.length ? h('div.panel.row', { style: 'padding:6px 12px;gap:6px' }, h('span.small.dim', 'Your charms'), ...run.st.charms.map((c) => charmIcon(c, true))) : '',
        ),
        h(
          'div.row',
          { style: 'justify-content:center;gap:16px;margin-top:auto' },
          h('div.panel', { style: 'padding:10px 16px;max-width:620px' }, h('div.small', home ? 'Cash doesn’t carry over to your next run: gear and ornaments you buy are yours forever.' : 'Gear and ornaments are yours forever. Charms last until the run ends. Your score never goes down when you spend.')),
          run.solo
            ? h('button.primary.big', { onclick: () => (audio.sfx('click'), run.ready()) }, home ? 'Head home ▶' : 'Back on the road ▶')
            : h('div.row', h('span', 'Leaving in ', timerText), h(`button.${me?.ready ? 'teal' : 'primary'}.big`, { onclick: () => run.ready(!me?.ready) }, me?.ready ? `✓ Ready (${run.players.filter((x) => x.ready).length}/${run.players.length})` : 'Ready!')),
        ),
      );
    };
    render();
    run.onPhase = () => render();
    root.appendChild(h('div.screen', { style: 'background:linear-gradient(180deg,rgba(10,14,34,0.1),rgba(10,14,34,0.55))' }, body));
    return () => {
      clearInterval(tick);
      run.onPhase = null;
    };
  });
}

export { ornCard };
