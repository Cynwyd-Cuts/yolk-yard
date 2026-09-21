# Yolk Yard — GitHub Pages with a free Cloudflare backend

This build replaces the paid Render proposal with Cloudflare Workers Free and one SQLite Durable Object. Nothing in this repository creates a paid subscription. Keep the account on **Workers Free**. A free `workers.dev` address is sufficient; no domain purchase, Render service, payment processor, or separate database subscription is needed.

Players use https://zl-2.github.io/yolk-yard/ and the owner dashboard is https://zl-2.github.io/yolk-yard/admin.html. GitHub Pages hosts the interface; the existing Cloudflare Worker stores approvals and runs matches in the background. No redirect, iframe, or paid domain is required.

The frontend endpoint is public configuration in `public/client.js`. The Worker allowlist is `CLIENT_ORIGINS` in `wrangler.jsonc`. When deploying your own copy, configure both for your own Pages origin and Worker. The admin key and database never go in the repository.

## Owner setup in the browser

1. Sign in at https://dash.cloudflare.com/ and keep the Workers **Free** plan.
2. Open **Workers & Pages → Create application → Import a repository** (the GitHub import option). Connect GitHub and select `ZL-2/yolk-yard`.
3. Select production branch `main` so future game and service updates deploy together. Use application name `yolk-yard`, repository root, build command `npm run build`, and deploy command `npm run deploy`. Set build variable `NODE_VERSION` to `24`. Disable non-production branch builds for this service. Deploy.
4. Open the new Worker's **Settings → Variables and Secrets**. Add a runtime **Secret** named `ADMIN_SECRET`, containing a unique password-manager-generated random value of at least 32 characters. Save/deploy the secret. This is a runtime secret, not a build variable. Save your copy privately; never put it in GitHub or chat.
5. Keep GitHub Pages enabled with GitHub Actions as its publishing source. The workflow publishes `main`. If you previously used `feature/browser-access-public-matches` as the Cloudflare production branch, switch it to `main` now that the integration is merged. Open your Pages `/admin.html`, enter your owner key, then request access from the Pages game and approve it. Your game screen enters automatically. The Worker `/admin` remains available too.
6. Approve friends from the dashboard or create single-use activation codes. They need only the game URL and their browser. Match creators choose private/public and can change it from the lobby or pause menu. Only approved players can browse public matches.
7. Share the GitHub Pages URL. Browser storage is separate between Pages and the Worker address. If you already approved someone on the Worker URL, approve their Pages request as a replacement for that existing player. The existing database and codes are preserved.

The SQLite binding and migration are created by `wrangler.jsonc` during deployment; do not create a paid database. If the page says “Owner setup required”, finish step 4. Missing owner credentials fail closed. If Cloudflare asks you to upgrade to deploy this SQLite configuration, stop and check the error instead of subscribing.

Official build settings: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/

## Free-plan capacity

Cloudflare's Free plan has finite daily quotas. Exceeding a free Durable Object quota rejects operations until its reset, rather than adding overage charges while the account remains Free. Quotas are shared with other applications in the same account. This is suitable for a small friends' game, not unlimited public traffic.

As checked September 21, 2026, the Durable Object allowance includes 100,000 request units/day, 13,000 GB-seconds/day, 5 million SQL rows read/day, 100,000 rows written/day, and 5 GB storage. Incoming WebSocket messages count at 20 messages per request unit. Workers also have their own request/CPU limits. See https://developers.cloudflare.com/durable-objects/platform/pricing/ and https://developers.cloudflare.com/workers/platform/limits/ for current limits.

All matches share one object, with a conservative limit of four simultaneous rooms and eight players per room. Match simulation is held in memory; it is not written to the database every frame. Timers stop when the last game session disconnects. A continuously active single object uses roughly 11,060 GB-seconds/day at its allocated 128 MB, below the object-duration allowance by itself. Message/request quotas can still be reached first; the room cap is not a load-tested capacity guarantee. Monitor usage in Cloudflare and keep the Free plan.

Deploys and runtime restarts end current matches, but browser approvals, codes, and revocations survive. Players reload to reconnect. Do not rename the Worker, object class, or singleton ID casually: those determine which persistent database is used.

## How access works

- A player submits their name and optional note. On Pages, a random browser token is retained in local site storage and sent explicitly to the Worker; owner sessions use tab session storage. No third-party cookies are needed. On the Worker URL, existing HttpOnly, Secure, SameSite=Strict cookies still work. Only hashes are stored in the database. The browser polls for approval and enters automatically after approval.
- Cross-origin API requests allow only configured exact origins and ignore cookies. WebSocket connections from Pages require an approved browser to obtain a single-use, 30-second ticket. The permanent browser token is never put in a URL. Server-side approval and session checks remain mandatory.
- Requests include a reference for verifying the person in person or through your normal communication channel. Typed names do not prove identity.
- Approvals attach a browser to a player record. Approving a replacement immediately revokes the old browser and ends its game session. Clearing browser site data or changing browsers requires another approval or replacement code.
- An approved player gets one active WebSocket session across tabs and copied credentials. A second session is rejected instead of evicting the first. Closed/dead connections are released; heartbeat timeout is at most about 30 seconds.
- Activation codes contain 160 bits of randomness, expire after seven days, and are stored as hashes. Redemption is transactional. Used/cancelled/expired codes cannot be reused. For the same person on a replacement browser, choose their existing player record when issuing a code or approving the request. A code for a **new player** creates a separate entitlement.
- Revocation immediately ends gameplay and invalidates outstanding replacement codes. The owner can mark a player free or paid. Paid is manual bookkeeping, **not payment processing**.
- Public matches are visible only to approved players. Private matches require an invite code. The host can switch visibility in the lobby or pause menu. Switching to private removes discovery; existing guests stay and approved players with the invite code can still join. The host can remove a guest; that guest is blocked from that room until it closes.
- All online match simulation and host privileges are enforced by the server. Sending fabricated client state cannot change scores. Hosting-tab background throttling no longer slows the simulation, although closing the host's tab still closes the room.

## Limits

This deters casual sharing; it cannot stop someone lending a device or deliberately transferring browser credentials. Existing downloadable or forked copies of the public source are not retroactively protected. They cannot join this protected server without an approved session. Offline practice is client code and can be reproduced by someone who has a copy. Access restrictions protect the hosted service, not ownership of already distributed code.

## Local development and checks

Use Node 24 and run `npm ci`, `npm run build`. Put a development-only owner key into an ignored `.dev.vars` file as `ADMIN_SECRET="your-random-value-of-at-least-32-characters"`, then run `npm run dev:cloudflare`. Local cookies omit Secure on localhost; public HTTPS uses Secure cookies.

- `npm test`: game rules and shared HTTP/WebSocket access controls.
- `npm run check:cloudflare`: bundle and validate the Worker without deploying.
- `npm run test:cloudflare`: real local Cloudflare runtime, including protected assets, code reuse, WebSocket matchmaking, host permissions, revocation, heartbeat, and database persistence across restart.
- `npm run test:pages`: the full UI flow served from a separate origin and `/yolk-yard/` subpath, including access, owner login, public matches, privacy and revocation.
- `npm run test:access-browser`: production UI in independent Chromium contexts, including owner approval, activation, public discovery, gameplay, privacy toggles, rematch, and revocation. Optional `YOLK_TEST_CHROME` selects an installed Chromium.

The Node server remains available for local testing with `ADMIN_SECRET` set and `npm start`; it is not required for Cloudflare hosting. Its SQLite data is separate from Cloudflare data.

To deploy from a computer instead of Git integration: `npm ci`, `npm run build`, `npx wrangler login`, `npm run deploy`, then `npx wrangler secret put ADMIN_SECRET`. Enter the secret at the prompt; do not add it as a command argument or commit it.

Owner sessions expire after eight hours. Rotating the owner key blocks new sign-ins with the previous key; existing owner sessions remain until expiry or logout. Keep the key private.
