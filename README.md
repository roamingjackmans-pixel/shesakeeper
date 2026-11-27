# She's A Keeper

A roguelite fishing game. Drive to a fishing hole, pick the right gear for its mission, cast into the bubbles, reel
them in, spend your catch at the bait shop on the road, and do it again. Somewhere out there is **Marlene**, the
golden legend every angler swears they saw. She's real. She's a keeper.

Plays at **https://josephjackman.com/games/shesakeeper/** in a desktop browser. Solo, a Daily Catch, or up to four
friends on the same lake. Email + password accounts (the same ones as Shoallhell, Smash Your Bros and Baker's Dozen).

## How it plays

- **A run** is three fishing holes, two and a half minutes of fishing each. You drive to each one, see its mission,
  pick your gear, fish, then stop at the bait shop. The third shop is on the way home, then your score.
- **Casting.** Move the mouse to aim (a dotted line shows your reach). Hold the button (or Space) and the cast meter
  swings up and down; let go to cast. A ring shows where the bobber will land. The very top of the meter is a
  **Perfect Cast** (farther, and better catches).
- **Bubbles.** Spots of fizz come and go on the water. Cast into one and a fish bites in a second or two instead of
  five to ten, and better fish live there. Land dead centre for a **Bullseye**. Each spot holds one to three fish,
  then pops; in co-op you race each other for them.
- **The bite.** The bobber dips for nibbles (wait…) and plunges with a **!** for the real bite: click to hook it
  before the ring runs out.
- **Reeling** is the Stardew-style catch bar: hold to lift the green bar, let go and it falls (and bounces). Keep the
  fish inside and the catch meter fills; let it out and it drains. Fish dart, sink, float and lunge by species.
  Never let it leave the bar for a **Perfect** catch. Sometimes a **treasure chest** shows up on the track: hold the
  bar over it too, for cash, a run charm or a dash ornament.
- **Points** come from the species, its size (bigger is worth a lot more), quality stars (Silver ×1.25, Gold ×1.5,
  Rainbow ×2 for perfect catches of big fish), your gear and perks, a streak bonus for fish in a row, and the mission.
- **Missions.** Every hole rolls one from its fish: *Small Fry* (fish under 22 cm ×3), *Trophy Hunt*, *Most Wanted*
  (one species ×5), *Family Reunion* (catfish, trout, bass…), *Variety Pack*, *Perfectionist*, *Bubble Trouble*,
  *Long Shot*, *Heavyweight*, *Quick Hands*, *Gold Standard*, *Numbers Game*, *Treasure Hunt*, *Night Hunters*.
  Matching fish score the mission's multiplier; reach the goal and the whole hole scores ×1.5. The mission changes
  every hole, so the right gear does too: gear that fits is marked ✓ at the gear-up screen.
- **Fishing holes.** Seven kinds of water (pond, lake, river, bayou, coast, ice lake, mountain tarn), four times of
  day and six kinds of weather, each with its own fish: 43 species plus junk, from Fathead Minnows to Bluefin Tuna.
- **Marlene.** Any hole might draw Her out: a golden ripple and a flash of gold leaping clear. Cast into the ripple
  for a chance she takes the hook. She is the hardest fish in the game. Land her for a fortune, a Pearl dash ornament
  and The Keeper's Rod.

### Gear, ornaments and charms

- **Gear** (11 rods, 14 lures, 11 bait) is bought at the bait shop during a run and **kept forever**. Each piece is
  good at something (a bigger catch bar, reel speed, cast range, bite speed, attracting catfish or trout, treasure,
  double catches…). There's no best set: it depends on the mission.
- **Dash ornaments** are rolled relics, Nightreign style. Each has one to three good perks with random values in a
  range (e.g. *+5–25% catch bar size*); any perk can bring a curse along, and a strong roll (or a potent perk like
  bigger fish or double catches) always does. Tiers: Plastic, Brass, Silver, Gold, and Pearl (Marlene's). Three ride
  on your dash, visible in the truck on every drive (click one to flick it and read its perks). Keep up to 60 in the
  glovebox; sell the rest at the shop. Once you own all the gear, the hunt is for the perfect ornaments.
- **Run charms** (28, Balatro-joker-like) last until the run ends: *Last Call* (last 45 s ×2), *Collector's Badge*,
  *Glass Hook*, *Piggy Bank* interest, *Double Down*… Three can be on at a hole.
- **Cash and score.** Every point you catch is also a dollar to spend this run. Spending never lowers your score.
  Cash doesn't carry over between runs; what you buy does. Rerolls cost $40, then $65, $90…

### Modes

- **Go fishing**: a solo run.
- **Daily Catch**: the same waters, missions and 2–3 twists for everyone that day (US Central), with your own gear.
  Play as often as you like; your best score goes on the board with your friends'. The first daily each day gives a
  free dash ornament. Twists include *Tiny Tuesday*, *Bubble Bath*, *Upside Down*, *Ghost Lake*, *Storm Chaser*
  (lightning doubles points), *Marlene Watch*, *Glass Line* and more.
- **Fish with friends**: up to four anglers in one truck. Host a lobby (4-digit code), invite friends or join theirs.
  The host can add up to three twists as house rules. Everyone fishes the same lake at the same time (same bubbles,
  same clock, same Marlene), each with their own gear, shop and saves. At each hole there's 90 seconds to gear up (or
  until everyone is ready); the shop gets 75. Ranked by score at the end.

## Run it locally

Needs Node 22+ and the Shoallhell repo next to this one (for accounts and co-op). PowerShell:

```powershell
cd C:\dev\ShesAKeeper; npm install
npm run dev        # Shoallhell's server on :3031 + the game on http://localhost:5178/games/shesakeeper/
npm run typecheck; npm test
npm run build
```

"Play offline" works without the server. Development switches: `?bot` lets a bot fish for you (`?bot=0.8` a worse
one), `?holesec=30` makes holes 30 seconds, `?slot=2` keeps a second sign-in in another tab.

## How it deploys

1. **The page** goes to GitHub Pages through the `games` repo: every push to `main` runs
   `.github/workflows/ready.yml` (type check, tests, build) and puts the built site in `site/` on the `ready` branch;
   `deploy/library.json` in the games repo lists `{ "folder": "shesakeeper", "repo": "shesakeeper", "publish": "site" }`.
   The page finds the server from `site/config.json` (the `SAK_SERVER` repository variable, default
   https://shoallhell.fly.dev).
2. **The server** is Shoallhell's (`C:\dev\Shoallhell`, game id `sak`: `/api/sak/me`, `/api/sak/profile`,
   `/api/sak/daily`, and the shared lobby relay). Changes to it ship with `fly deploy` from that repo.

## Code map

```
src/core/     the rules, no browser: stats, fish picking, the catch bar, an angler's cast→bite→reel, the shared lake,
              missions, scoring, ornament rolls, the shop, runs, the save
src/data/     fish, gear, perks and curses, ornament types, charms, daily twists, fishing holes
src/render/   canvas drawing: the lake, anglers, fish, ornaments, gear icons, the drive, the reel and cast meters
src/ui/       screens: title, garage, gear-up, fishing (input + HUD), shop, results, lobby, friends; runner.ts runs a run
src/net/      Shoallhell's API and socket, and the co-op link
src/audio/    every sound and the music, made with Web Audio (no files)
tests/        rules tests (the catch bar's difficulty curve, ornament curse rules, whole holes played by a bot)
```
