# Verification status

## Completed locally

- Production build succeeds with relative URLs for GitHub project Pages.
- Simulation regression tests cover collision, jumping, ray obstruction,
  movement/input validation, brief network button presses, damage and shields,
  friendly fire, ammo/reloading, respawn, captures and crown returns, contested
  zones, full rounds in all four modes, map navigation, and all primary weapons.
- Rendered Chromium checks exercise real keyboard/mouse movement, look, jumping,
  firing, reload, sidearm swap, popper throwing, and practice pause.
- Appearance is saved and restored through localStorage.
- All three maps render and reach the results menu.
- Desktop and narrow phone layouts were inspected. Touch controls render.
- No JavaScript errors in the browser UI checks.
- No production QA hooks in the compiled bundle.

## Multiplayer verification still required

The local PeerServer successfully opens rooms and exchanges connection offers,
but this execution environment does not provide usable WebRTC ICE network
candidates. Its network-interface enumeration is restricted. Two-client game
traffic therefore **has not passed local end-to-end verification**.

The complete two-browser WebRTC test is included in
`scripts/browser-check.mjs` and is a required GitHub Actions gate before Pages
deployment. It tests joining, host start, replicated guest movement, remote
loadout/respawn, shared results, rematch, and host departure using a local
signaling server. Do not mark multiplayer verified until that gate passes.

Public PeerJS signaling availability and connectivity on the intended school
Wi-Fi must also be checked on that network. Neither access to GitHub Pages nor
a successful CI test guarantees that a particular network permits WebRTC.

No physical Mac/Safari or physical touchscreen test has been performed.
Audio synthesis is exercised in code, but the sound mix has not been listened
to on a physical device.

## Reproduce

```
npm ci
npm test
npx playwright install chromium
npm run test:browser
npm run build
```

`YOLK_TEST_UI_ONLY=1 npm run test:browser` runs UI checks without claiming to
verify multiplayer. `YOLK_TEST_MULTIPLAYER_ONLY=1` selects the multiplayer path.
`YOLK_TEST_CHROME=/absolute/path/to/chromium` selects an existing test executable.

Production is static and contains no test server, browser automation, or QA
controls. `?qa=1` enables diagnostics only when running the development server.
