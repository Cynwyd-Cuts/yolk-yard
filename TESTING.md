# Verification

The current commit's GitHub Actions run is the authority for release status.
The workflow requires simulation, browser multiplayer, and visual-quality
checks before publishing; it also exercises the published site afterward.

## Version 2 coverage

- 19 simulation checks cover movement, stepping/jumping, shielding, ammunition,
  reloads, respawns, objectives, full bot rounds, every primary class, and input
  sequence validation.
- Projectile regression checks exercise finite travel and gravity, muzzle
  origins, low cover that blocks the barrel but not the eye, swept collision
  through thin cover, and surface-normal popper rebounds and fuse timing.
- Navigation checks cover safe spawns and objective areas, a climb to the dock
  deck, and the open ground-level route beneath the bridge.
- Browser checks exercise actual keyboard/mouse controls, ammo, reloads,
  appearance persistence, pause, results, narrow layouts, and touch controls.
- Two independent browser sessions connect through real WebRTC: room creation,
  guest join, host start, movement replication, remote loadout/respawn,
  host-authoritative guest projectile damage, shared results, rematch, and closure.
- The quality suite captures every weapon and its sight, verifies all seven
  loadout model images, checks real muzzle-flash alignment and traveling bolts,
  renders all maps with a full bot room, and checks mobile loadout presentation.
  It exercises both Low rendering and High rendering with shadows.
- The post-deployment smoke check uses the published HTTPS site and public
  PeerJS signaling to create a room, connect two production clients, start a
  match, and close the room. No development hooks are used in that check.

The version 2 simulation checks and local UI checks passed during development.
Screenshots are written to `test-results/quality/`; each Actions run retains
its browser and live-site artifacts for seven days.

## Limits

No physical Mac/Safari or physical touchscreen test has been performed.
Automated Chromium checks are not a frame-rate guarantee for every laptop.
The synthesized sound mix has not been listened to on a physical device.

School Wi-Fi must be checked on that network. Access to GitHub Pages or a
passing CI test does not guarantee that a particular network permits WebRTC.
No paid TURN relay is provisioned. Host departure ends the room.

## Reproduce

```sh
npm ci
npm test
npx playwright install chromium
npm run test:browser
npm run test:quality
npm run build
GAME_URL=https://cynwyd-cuts.github.io/yolk-yard/ node scripts/live-check.mjs
```

`YOLK_TEST_UI_ONLY=1 npm run test:browser` runs UI checks without claiming to
verify multiplayer. `YOLK_TEST_MULTIPLAYER_ONLY=1` selects the multiplayer path.
`YOLK_TEST_CHROME=/absolute/path/to/chromium` selects an existing test executable.

Production is static and contains no test server, browser automation, or QA
controls. `?qa=1` enables diagnostics only when running the development server.
