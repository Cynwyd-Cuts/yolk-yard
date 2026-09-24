# Persistent gameplay relay

Replaces the D1-polling relay with **one persistent Node process**, direct WebSocket delivery, bounded queues, public/private listings, authenticated 10-second resume windows, and sequenced replay in both directions. No game data is written to a database. Client recovery lasts 8 seconds, then normal host-transfer/error handling resumes.

## Deploy

Use a host supporting a continuously running Node 24 process and HTTPS/WebSockets. Build with `server/realtime/Dockerfile` (repository root as build context), or run `npm ci --omit=dev` then `npm run start:relay`. Set `PORT` to the provider's assigned port. Set `ALLOWED_ORIGINS=https://zl-2.github.io` (comma-separated exact origins if needed). Use one instance: independent replicas do not share rooms. `/health` returns `yolk-realtime-v2`; `/game` is the WebSocket endpoint. Do not use a static host, request-scoped serverless function, or idle-sleeping service.

Before switching, run `YOLK_RELAY_URL=wss://YOUR-HOST/game node scripts/relay-live-check.mjs`, then test two real school computers in both modes for several minutes. Change `public/network-config.js` to the verified endpoint and update the live-check endpoint in `.github/workflows/pages.yml` in the same commit. The original endpoint is retained until the new server is hosted and verified. GitHub Pages cannot run this server.

`npm run test:realtime` runs real Arena and Royale simulations, room discovery, late join, 16-player capacity, host transfer, forced socket interruption, and 65 seconds of sustained gameplay per mode. `RELAY_SOAK_MS` changes only the sustained phase. Local checks do not establish latency on school Wi-Fi.

Server restarts lose rooms; reconnect recovery covers transient socket/network failures within the same process. No user login is added. Origin checks restrict browser use but are not user authentication. This private-alpha service targets modest player counts; multiple instances require a shared routing/room-owner architecture.
