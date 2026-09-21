# Yolk Yard

Play at https://zl-2.github.io/yolk-yard/. Opens directly without accounts or an access server. Invite-code multiplayer and the public-match directory use PeerJS; practice runs locally.

Public hosts publish temporary listings through a browser-coordinated directory. A new coordinator is elected when the previous browser leaves; listings may take a few seconds to return. Switching a room to private removes its listing. Hosts must keep their tabs open. Multiplayer and discovery require a network that permits PeerJS and WebRTC. No paid relay is configured.

The instructions below describe local development and gameplay.

# Yolk Yard

An original 3D multiplayer egg arena shooter built for GitHub Pages. JavaScript,
Three.js, and PeerJS. No Java, Eclipse, account, or software installation for players.

## Play

[Play Yolk Yard](https://cynwyd-cuts.github.io/yolk-yard/)

Open the published HTTPS site in current Chrome, Edge, Firefox, or Safari with
WebGL 2 enabled. Choose **Practice with bots** or **Play with friends**.

For friends: create a room, copy the invite link or code, and keep the host's tab
open and in front. Friends choose **Join a room**, enter the code, and wait for
the host to start. Maximum 8 players including bots. Friends replace bots when
the room is full. Rooms end when the host leaves; there is no host migration.

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
- Free for all, Team scramble, Capture the crown, Sunny side zone control.
- Bot practice and optional bots in private rooms, with three difficulty levels.
- Spawn protection, automatic respawn, health regeneration, health/ammo pickups.
- Timed rounds, scoreboards, results, rematches, saved local match totals.
- Eight shell colors and five headwear choices; all unlocked, no purchases.
- Mouse sensitivity, field of view, sound, graphics, and drag-look settings.
- Touch movement/look/action controls and responsive menus.
- Original procedural 3D meshes and synthesized sound. No asset CDN needed.

## Controls

| Action               | Control               |
| -------------------- | --------------------- |
| Move                 | WASD or arrow keys    |
| Look                 | Mouse                 |
| Fire                 | Left click            |
| Aim                  | Right click or Shift  |
| Jump                 | Space                 |
| Reload               | R                     |
| Throw popper         | E or G                |
| Primary / sidearm    | 1 / 2, or Q to toggle |
| Scoreboard           | Tab, or Scores button |
| Release mouse / menu | Escape                |

If mouse lock is unavailable, enable **Drag to look** in Settings, then hold
right click and drag. A current desktop browser is recommended for a shooter.
On a touch device, use the left joystick and right look area/action buttons.

## Publish in GitHub Pages

1. Put this project's contents in a repository, with `package.json` at the root.
2. Open the repository's **Settings → Pages** and select **GitHub Actions** as
   the source.
3. Push to `main` (or run **Test and publish Yolk Yard** in Actions).
4. GitHub installs the pinned dependencies, runs the simulation and browser
   multiplayer tests, builds the static game, and publishes it. It then checks
   the live site's connection to the public room service.

Relative asset paths are configured, so project sites under `/repository-name/`
work without changing the source. A `.nojekyll` file is included.

The `dist` folder from `npm run build` is also ready for any ordinary static
HTTPS host. Do not open `index.html` directly with `file://`; browser module
and WebRTC security requirements need a web server.

## Multiplayer architecture and limits

GitHub Pages hosts static game files. **It does not run the match server.**
The host's browser runs a fixed 60 Hz simulation, and peers exchange real
WebRTC data messages. PeerJS's public cloud service handles room discovery and
connection signaling. Snapshots are sent at 20 Hz. Joining clients predict
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

The host must keep the tab in front. Background throttling or the host losing
connectivity can pause or end a match. Rooms and public listings are ephemeral. No central accounts, cross-device progression, ranked service, voice, or text chat.

## Develop and test

Node.js 24 or later:

```sh
npm ci
npm run dev
npm test
npx playwright install chromium
npm run test:browser
npm run test:quality
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


