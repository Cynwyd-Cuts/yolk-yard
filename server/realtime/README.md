# Persistent gameplay relay

Replaces the D1-polling relay with **one persistent Node process**, direct WebSocket delivery, bounded queues, public/private listings, authenticated 10-second resume windows, and sequenced replay in both directions. No game data is written to a database. Client recovery lasts 8 seconds, then normal host-transfer/error handling resumes.

## Deploy

Use a host supporting a continuously running Node 24 process and HTTPS/WebSockets. Build with `server/realtime/Dockerfile` (repository root as build context), or run `npm ci --omit=dev` then `npm run start:relay`. Set `PORT` to the provider's assigned port. Set `ALLOWED_ORIGINS=https://zl-2.github.io` (comma-separated exact origins if needed). Use one instance: independent replicas do not share rooms. `/health` returns `yolk-realtime-v2`; `/game` is the WebSocket endpoint. Do not use a static host, request-scoped serverless function, or idle-sleeping service.

Before switching, run `YOLK_RELAY_URL=wss://YOUR-HOST/game node scripts/relay-live-check.mjs`, then test two real school computers in both modes for several minutes. Change `public/network-config.js` to the verified endpoint and update the live-check endpoint in `.github/workflows/pages.yml` in the same commit. The original endpoint is retained until the new server is hosted and verified. GitHub Pages cannot run this server.

`npm run test:realtime` runs real Arena and Royale simulations, room discovery, late join, 16-player capacity, host transfer, forced socket interruption, and 65 seconds of sustained gameplay per mode. `RELAY_SOAK_MS` changes only the sustained phase. Local checks do not establish latency on school Wi-Fi.

Server restarts lose rooms; reconnect recovery covers transient socket/network failures within the same process. No user login is added. Origin checks restrict browser use but are not user authentication. This private-alpha service targets modest player counts; multiple instances require a shared routing/room-owner architecture.

## Owner analytics

The game contains a hidden entry gesture for the owner dashboard. The gesture is **not** authentication: the owner code is checked server-side, and neither the numeric code nor its hash belongs in the public repository or client JavaScript. To enable access, set `YOLK_OWNER_CODE` in the relay host's private environment to a randomly generated **12–32 digit** value. Do not include it in GitHub, Vite variables or `network-config.js`. No valid code exists when this variable is absent. Login is rate-limited, creates a short-lived token held only in the current browser tab's memory, and the protected summary is never returned without that token.

The dashboard shows anonymous active/recent sessions, mode, duration, visit totals and live room/relay counts. No IP addresses, player names or chat are collected. In-memory history disappears on restart. For history across redeploys, provision a persistent disk for the relay and set `YOLK_OWNER_DATA_PATH` to a writable file on that disk (for example `/data/yolk-owner.json`). Render's default filesystem is ephemeral; do not claim durable history until the disk is attached. Up to 1,000 ended sessions from the past 30 days are kept. The owner UI indicates whether persistence is configured. The server reads the file on startup, writes updates atomically and restricts the file permissions to the running user.
