# CLAUDE.md — She's A Keeper

A roguelite fishing game (README.md): Stardew-style casting and catch bar, two 4-minute holes per run with missions, a
Balatro-style bait shop, Nightreign-style dash ornaments, Marlene the legendary fish. Browser game (Vite + TypeScript,
no framework): canvas for the lake and the truck, DOM menus on a fixed 1600×900 stage scaled to the window. Desktop
only (owner's choice). Online through **Shoallhell's server** (`C:\dev\Shoallhell\server`, shared accounts, game id
`sak`). Hosted at `https://josephjackman.com/games/shesakeeper/`.

## How we work
- Windows 11 + PowerShell 5.1 for anything given to the owner (chain with `;`).
- Commit/push only when asked.

## Rules that are easy to break
- No `Math.random()` in `src/core` (except `bot.ts`'s callers): rules use the seeded `Rng`, so dailies and co-op lakes
  match for everyone. Render and UI code may use it for decoration.
- `RunState`, `RunConfig`, `HoleSpec`, `Ornament`, `Profile` stay plain JSON: they cross the co-op relay and the save.
- In co-op only the host runs the shared lake (`HoleWorld.update`: clock, bubbles, Her ripple, lightning); every
  player runs their own `Angler` locally and tells the host about bubble claims. Phases and timers are the host's.
- Every stat change goes through `src/core/stats.ts` keys (gear, perks, curses, charms, mods all add to the same
  numbers). A new perk is a line in `src/data/perks.ts`; a curse may never share a `group` with a good perk on the
  same ornament (tests/core.test.ts checks thousands of rolls).
- The catch bar's difficulty curve is tested with a bot that has a human reaction time (`LaggedEye`); after touching
  `src/core/catchbar.ts` keep `tests/core.test.ts` green.
- Canvas: no `filter` / `shadowBlur`; static scenery is drawn once into layers (`render/canvas.ts` `layer()`). Don't
  draw a full-screen layer that is mostly transparent every frame (the drive's dash was 33 ms a frame on weak GPUs).
- Menu pictures (fish, ornaments, gear) are sprites copied into small canvases with `render/pics.ts`; never
  `toDataURL` them. The canvas resolution is capped and drops by itself on slow machines (`render/canvas.ts`).

## Commands
```powershell
npm run dev                      # Shoallhell server :3031 (from ..\Shoallhell) + Vite :5178 (launch config "shesakeeper-dev")
npm run typecheck; npm test
npm run build
```
Dev: `?bot` (a bot fishes for you), `?holesec=30` (short holes), `?slot=2` (second sign-in). In development
`window.__sak.run()` is the running run.
