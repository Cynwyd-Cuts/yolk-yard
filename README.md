# Yolk Yard

[Play Yolk Yard](https://zl-2.github.io/yolk-yard/) — an original browser egg shooter with arena modes and **Yolk Royale**. Open the HTTPS site in a current browser with WebGL 2. No account or download is required.

## Yolk Royale

Choose **Yolk Royale** on the home screen:

- **Find public match** discovers a waiting Royale lobby. If none is available, it creates one with a 30-second countdown and fills empty seats with bots.
- **Create public / private match** lets the host choose 2–16 contestants, bot count/fill, difficulty and normal/quick storm. Private matches use an invite link or code and stay out of the directory.
- **Play local with bots** immediately starts a sixteen-contestant round on your device. Menus pause local play; online rounds keep running.

Ride the Eggspress over the 512 × 512 Sunnybreak island, choose one of nine districts, skydive and deploy your shell glider. Start empty, search chests and collect floor loot. Five slots hold eleven blasters and eight healing, shield, explosive or mobility items. Sprinting uses regenerating stamina. Eight nested storm stages close the island until one egg survives.

One life per round. Eliminated players and late arrivals spectate living contestants, with target switching and their health, shields and inventory. The host can start a fresh rematch through editable setup. Four additional spectator seats are available during a round.

The original sound system contains 79 named effect cues, eleven weapon palettes and five continuous environmental layers. It covers transport, gliding, surfaces, stamina, combat, reloads, chests, loot, consumables, mobility, supply drops, storm, spectating and results. Settings have separate master, effects, ambience and music controls. Audio starts after user interaction.

See [the complete design and rules](docs/BATTLE_ROYALE.md). Arena modes retain their original maps, loadouts, eight-player limit and respawn rules.

## Version 2 quality update

- Eight distinct beveled weapon models, including the Pip sidearm, with detailed
  barrels, grips, magazines, stocks, and sights. Loadout images render those same
  models rather than using unrelated artwork.
- Physical open/reflex sights; the Needle's 3.5× scope and Duet's 1.8× prism render
  a separate magnified view inside the modeled lens, with a reticle and range marks.
- Muzzle-origin traveling bolts, visible trails and flashes, game-world gravity,
  swept collision, surface impacts, and surface-normal popper bounces. Damage
  happens on arrival. Low cover can block a barrel even when the eye is above it.
- Three rebuilt arenas: 80 × 80 glasshouse gardens, an 84 × 84 freight harbor with
  a bridge and underpass, and an 88 × 88 terraced town with rooftop routes.
  Bot navigation handles both ground routes and raised platforms.
- Static architectural and weapon details are batched by material to keep the
  extra visual detail from requiring a draw call for each part.

Refresh all players' pages before creating a new room after this update.
Version 2 uses a new multiplayer protocol and separate room namespace.

## Included

- Seven primary classes: Sprinter, Scatter, Needle, Zipper, Thumper, Anchor, Duet.
- Pip sidearm, timed poppers, ammunition, reloads, modeled optics, hit feedback.
- Three original arenas: The Yard, Cargo Club, Sunset Social.
- Yolk Royale, Free for all and Team scramble. Arena maps have connected galleries, stairs and an upper crossing.
- Bot practice and optional bot-filled matches, with Easy, Normal, Hard and Impossible difficulty.
- Arena spawn protection, manual respawn, health regeneration and health/ammo pickups.
- Timed arena rounds; Royale continues until one survivor. Placement banners lead into scoreboards and rematches.
- Shell colors, patterns, finishes, headwear and eyewear; all unlocked, no purchases.
- Mouse sensitivity, field of view, sound, graphics, and drag-look settings.
- Touch movement/look/action controls and responsive menus.
- Original procedural 3D meshes and synthesized sound. No asset CDN needed.

## Controls

| Action               | Control               |
| -------------------- | --------------------- |
| Move                 | WASD or arrow keys    |
| Look                 | Mouse                 |
| Fire                 | Left click            |
| Aim                  | Right click  |
| Jump                 | Space                 |
| Reload               | R                     |
| Throw popper         | E or G                |
| Primary / sidearm    | 1 / 2, or Q to toggle |
| Royale slots         | 1–5, Q or mouse wheel |
| Royale search / take | Hold F for chests; F for floor items |
| Royale sprint        | Hold Shift |
| Royale map / inventory | M / I |
| Royale drop item     | X |
| Leave transport / deploy glider | Space |
| Scoreboard           | Tab, or Scores button |
| Release mouse / menu | Escape                |

Desktop play uses mouse lock. Press Escape for the menu; M and I open the Royale map and inventory without needing a pointer.
On a touch device, use the left joystick and right look area/action buttons.

## Publish in GitHub Pages

1. Put this project's contents in a repository, with `package.json` at the root.
2. Open the repository's **Settings → Pages** and select **GitHub Actions** as
   the source.
3. Push to `main` (or run **Test and publish Yolk Yard** in Actions).
4. GitHub installs the pinned dependencies, runs the simulation and browser
   multiplayer tests, builds the static game, and publishes it.

Relative asset paths are configured, so project sites under `/repository-name/`
work without changing the source. A `.nojekyll` file is included.

The `dist` folder from `npm run build` is also ready for any ordinary static
HTTPS host. Do not open `index.html` directly with `file://`; browser module
and WebRTC security requirements need a web server.

## Multiplayer architecture and limits

GitHub Pages hosts static game files. **It does not run the match server.**
The host's browser runs a fixed 60 Hz simulation, and peers exchange real
WebRTC data messages. PeerJS's public cloud service handles room discovery and
connection signaling. Snapshots are sent at 20 Hz in arenas and 10 Hz in Royale; unchanged island loot is not resent. Joining clients predict
local movement and reconcile against the host's acknowledged input sequence.

The host owns movement speed, collision, damage, ammo, reloads, respawns,
pickups, round scores, and objectives. Incoming inputs are clamped, sequence
checked, limited in rate and size, and expire if a client stops sending them.
This is suitable for friend rooms; the hosting player controls the authority,
so it is not a competitive, cheat-proof dedicated-server service.

Public signaling, STUN, and direct WebRTC connections must be reachable. Opening
a GitHub Pages site alone does **not** prove a school or other managed network
allows multiplayer. Symmetric NAT, client isolation, service outages, or blocked
WebRTC can prevent peers connecting. The app gives connection errors and offers
practice. No policy bypass, hidden transport, VPN, or proxy is included.

`public/network-config.js` lets a deployment operator configure their own
approved PeerServer and ICE/TURN servers. No paid relay is provisioned or
included. A TURN deployment is required for networks that need a relay; it
still needs to be permitted by the network. TURN credentials in static files
are public, so use short-lived credentials from your own service.

The oldest connected human takes over after the host leaves or stops sending snapshots. Half-second checkpoints preserve simulation state, inventory, storm progress and chat controls. The original invite code is reclaimed through signaling; recovery can briefly pause the game. All remaining browsers must still be able to reach one another. Rooms and public listings are ephemeral. No central accounts, cross-device progression, ranked service, or voice chat. Text chat is moderated and scoped to the current room.

## Chat and safety

Messages stay on screen; press **Enter** or **T**, or tap **Enter to chat**, to type. Open **Pause → Player controls & quick chat** for quick messages, preferences and room controls. Use Room or Team chat; spectators in an active match speak only to other spectators. Quick messages work on desktop and touch devices. Chat can be disabled, or limited to quick messages, in Settings or Players & safety.

All messages are checked before leaving the sender, at the host, and at the recipient. Names are filtered on save, profile admission, public listings, snapshots, events and result displays. Blocked input is not echoed into shared chat or saved to an abuse log. Common contact details, links, addresses, numeric identifiers, personal-information disclosures, common real names/locations, profanity, slurs, harassment and obfuscated variants are filtered. Typed chat supports English with normalized Latin characters; unsupported scripts fail closed and can use quick messages.

Players can mute or report others. A report uses a fixed reason, mutes that player locally, and notifies the room host. Hosts can silence/remove players and pause room chat. Spam throttles, duplicate rejection, a temporary cooldown after repeated prohibited submissions, verified sender identity, team routing and replay checks apply independently of the sender UI. Chat history is capped at 60 messages in memory and cleared on leaving; no late-join history or direct messages are sent.

**Limits:** this is a local rules/English NLP filter, not Roblox’s proprietary moderation service, and it cannot guarantee detection of every personal detail or prohibited expression. A name or place may be ambiguous, and entirely unknown information cannot always be recognized. The game has no central accounts, moderation staff, persistent global bans or trusted dedicated match server. Reports go to the current host; muting and leaving remain available if the host is the problem. A modified client/host can inspect or alter its own software; standard recipients independently reject unsafe text. Quick-message-only mode provides the most restrictive communication option. Do not claim Roblox equivalence or complete prevention.

See [CHAT_SAFETY.md](CHAT_SAFETY.md) for the policy, trust boundaries and regression coverage.

## Develop and test

Node.js 24 or later:

```sh
npm ci
npm run dev
npm test
npx playwright install chromium
npm run test:browser
npm run test:quality
npm run test:royale
node scripts/royale-solo-check.mjs
npm run build
npm run preview
```

Browser tests run a local PeerServer and two independent browser sessions to
exercise the actual WebRTC path. Local tests do not verify a school's Wi-Fi.
They write screenshots and a report to `test-results/`. Development-only QA
hooks require both Vite dev mode and `?qa=1`; they are removed from production.

## Project layout

- `src/simulation.js`: authoritative match rules, bots, combat, objectives.
- `src/physics.js`: movement, collision, ray tests, input validation.
- `src/maps.js`: map geometry, spawn points, bot navigation.
- `src/view.js`: Three.js scenes, modeled optics, muzzle effects, projectile presentation.
- `src/weapons.js`: shared authored weapon models and model portraits.
- `src/arenas.js`: batched architecture and distinct scenery for each map.
- `src/network.js`: room signaling, WebRTC lifecycle and message validation.
- `src/main.js`: menus, controls, prediction, HUD and game loop.
- `src/audio.js`: original synthesized effects.
- `tests/game.test.js`: simulation and physics regression checks.
- `scripts/browser-check.mjs`: real browser and two-client integration checks.

## Credits and privacy

Yolk Yard is independent and is not affiliated with Shell Shockers or Blue
Wizard Digital. It uses original names, maps, art, UI, and sound rather than
their source code, models, textures, or branding.

Your chosen name, appearance, settings, and cumulative results are stored in
localStorage on your browser. Gameplay and chosen display names are shared
with the host and room participants. The signaling provider sees connection
metadata, and peers can learn each other's network addresses through WebRTC.
No analytics, advertisements, camera, microphone, or payment systems are used.

See `THIRD_PARTY.md` for open-source notices. Original code is MIT licensed.


