# Verification

Run `npm ci`, `npm test`, `npm run build`, and `npx playwright install chromium`, then `npm run test:browser`.

The browser check starts a local PeerServer. It covers direct startup without an access service, bot practice, public discovery across independent browsers, switching private/public, joining from the directory, multiplayer movement, coordinator recovery, mobile layout, and removing closed rooms. It checks for browser exceptions and requests to the removed backend.

The game unit tests cover movement, combat, cosmetics, controls, scoped accuracy, and consecutive update numbers. Other scripts in `scripts/` are historical or focused diagnostics; `open-browser-check.mjs` is the current transport check.

For a live deployment, check the published GitHub Pages URL on a network that allows PeerJS/WebRTC. Local tests cannot establish whether a particular school or business network allows multiplayer.
