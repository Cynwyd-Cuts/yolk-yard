# Protected Yolk Yard: release and owner setup

This branch implements browser approval and server-run matches. It is **not a GitHub Pages build**. The old published Pages game is still unrestricted until the migration is completed.

## Hosting requirement

Use one always-on Node 24 process with HTTPS, WebSocket upgrades, and a persistent disk. The same origin serves the game, access screens, owner dashboard, APIs, and WebSocket endpoint. `render.yaml` prepares a single paid Render 0.5 CPU / 512 MB web service with a 1 GB persistent disk; it does not create a service or incur charges by itself. Check Render's current price before provisioning. Docker hosting with persistent `/app/data` also works.

Do not deploy to ephemeral disk, multiple replicas, or a serverless function: SQLite persists approvals while live rooms and single-session leases are held by one server. Scaling requires shared session/room routing first. The application caps at 32 rooms, but this is a safety cap, not a tested capacity guarantee for a small hosting plan. Load-test actual hosting before increasing use.

1. Deploy this branch from your `yolk-yard` repository, after its CI passes.
2. Set `APP_ORIGIN` to the exact HTTPS origin, without trailing slash (e.g. the host-provided service URL). Set `DATA_FILE` to the persistent mount. Set `NODE_ENV=production`. The Render template creates an `ADMIN_SECRET` automatically; never commit it or put it in browser code.
3. Visit `/admin`. Obtain the owner key through the hosting dashboard's environment settings and enter it there. This secure owner-only sign-in is separate from player access. Do not send the key in chat.
4. Open `/` in your normal browser, request access, and approve that request from the owner dashboard. Approve your friends or create activation codes.
5. Check two separate approved browsers joining a public match, changing it to private, and revoking a player during play on the live URL.
6. After the protected service is verified, replace the old GitHub Pages publication with a redirect or unpublish it. This branch's CI intentionally no longer publishes a nonfunctional static game.

Keep `TRUST_PROXY` unset unless your trusted reverse proxy **overwrites** `X-Forwarded-For` with a verified client address. Without it, rate limits are grouped by the immediate network peer, which is safer but may be conservative behind a proxy. Before production use, verify the host's proxy header behavior and set it appropriately. HTTP mutation requests and WebSocket upgrades require exact `Origin` matching.

## How access works

- A player submits their name and optional note. A random browser secret is set in an HttpOnly, Secure, SameSite=Strict cookie. Only its hash is stored. The browser polls for approval and enters automatically after approval.
- Requests include a reference for verifying the person in person or through your normal communication channel. Typed names do not prove identity.
- Approvals attach a browser to a player record. Approving a replacement immediately revokes the old browser and ends its game session. Clearing browser cookies or changing browsers requires another approval or replacement code.
- An approved player gets one active WebSocket session across tabs and copied credentials. A second session is rejected instead of evicting the first. Closed/dead connections are released; heartbeat timeout is at most about 30 seconds.
- Activation codes contain 160 bits of randomness, expire after seven days, and are stored as hashes. Redemption is transactional. Used/cancelled/expired codes cannot be reused. For the same person on a replacement browser, choose their existing player record when issuing a code or approving the request. A code for a **new player** creates a separate entitlement.
- Revocation immediately ends gameplay and invalidates outstanding replacement codes. The owner can mark a player free or paid. Paid is manual bookkeeping, **not payment processing**.
- Public matches are visible only to approved players. Private matches require an invite code. The host can switch visibility in the lobby or pause menu. Switching to private removes discovery; existing guests stay and approved players with the invite code can still join. The host can remove a guest; that guest is blocked from that room until it closes.
- All online match simulation and host privileges are enforced by the server. Sending fabricated client state cannot change scores. Hosting-tab background throttling no longer slows the simulation, although closing the host's tab still closes the room.

## Limits

This deters casual sharing; it cannot stop someone lending a device or deliberately transferring browser cookies. Existing downloadable or forked copies of the public source are not retroactively protected. They cannot join this protected server without an approved session. Offline practice is client code and can be reproduced by someone who has a copy. Access restrictions protect the hosted service, not ownership of already distributed code.

## Running locally

Use Node 24. Run `npm ci`, `npm run build`, then `npm start` with a securely generated `ADMIN_SECRET` of at least 32 characters in the process environment. The default local origin is `http://localhost:3000`; local cookies omit Secure only when NODE_ENV is not production. Never disable production cookie security for public hosting.

For live edits, run the backend on port 3000 with `APP_ORIGIN=http://localhost:5173`, and Vite on port 5173. Its API/WebSocket proxy uses the same origin. Open `/access.html` and `/admin.html` through Vite for those pages. Production testing should use the complete Node service.

## Verification and operations

`npm test` covers gameplay plus HTTP/WebSocket access checks, code expiry/reuse, owner-only controls, live revocation/replacement, session duplication, private discovery, and SQLite restart persistence.
`npm run build && npm run test:access-browser` tests the production bundle with independent browser contexts, approval and activation UI, mobile request layout, public matchmaking, joining mid-match, movement, firing, privacy toggles, rematch, and revocation. Optional `YOLK_TEST_CHROME` selects an installed Chromium executable.

Back up the persistent SQLite database using SQLite's online backup API (or stop the service before copying the database and its WAL files). Keep backups private. A deploy/restart preserves approvals but ends in-progress matches. Do not run two servers against the same database. Rotate `ADMIN_SECRET` in the host environment to invalidate the password; delete active rows from `admins` when immediately revoking existing owner sessions. Owner sessions expire after eight hours.
