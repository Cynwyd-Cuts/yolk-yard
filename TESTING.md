# Verification

Run `npm ci`, `npm test`, `npm run build`, and `npx playwright install chromium`, then `npm run test:browser`.

The browser check starts a local PeerServer. It covers direct startup without an access service, bot practice, public discovery across independent browsers, switching private/public, joining from the directory, multiplayer movement, coordinator recovery, mobile layout, and removing closed rooms. It checks for browser exceptions and requests to the removed backend.

The game unit tests cover movement, combat, cosmetics, controls, scoped accuracy, and consecutive update numbers. Other scripts in `scripts/` are historical or focused diagnostics; `open-browser-check.mjs` is the current transport check.

For a live deployment, check the published GitHub Pages URL on a network that allows PeerJS/WebRTC. Local tests cannot establish whether a particular school or business network allows multiplayer.

The chat gate (`scripts/chat-browser-check.mjs`) checks real host/guest WebRTC delivery, pre-send and host filtering, independent recipient filtering, name validation, team/spectator isolation, mute/silence/pause controls, quick-only preferences, typing input isolation, reports, mobile bounds and history cleanup. `tests/chat.test.js` adds adversarial protocol, PII, obfuscation, replay, spoofed sender, cooldown, split-message and bounded-history regressions.

In a runtime that cannot gather WebRTC ICE candidates, run the transport gate on GitHub Actions. A local visual-only check does not establish multiplayer correctness.
