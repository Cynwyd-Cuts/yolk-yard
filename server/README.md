# Shared game relay

`service/src/relay.js` is the deployed WebSocket transport source, mirrored from the existing
connection-check service. `relay-schema.sql` is its generated schema migration.
The Worker routes `/game` to `gameSocket(request, env)` with its D1 `DB` binding.
The deployed service also preserves `/health`, `/probe`, and `/rooms` diagnostics.

The complete service project (entrypoint, schema, migrations and build script)
is in `server/service/`. Its source is synchronized with the separately deployed
service; GitHub Pages does not execute it. Do not deploy the test Node server as
production: it deliberately uses a temporary local database and localhost.

Run `npm run test:relay` using Node 24 to exercise real WebSockets, the production
relay class, SQLite mailboxes, actual Network clients and both simulations.
Covers public/private discovery, code join, ordered inputs, large checkpoints,
host transfer, late admission, and connection renewal without losing channels.
Local tests do not establish remote database latency or school-network capacity.

Messages retain ordering; room addresses are exclusive, channel recipients are
bound to server-side sessions, listing publication requires owning the room
address, and message/session bounds constrain queues. Resume credentials are
random bearer tokens held only in browser memory during connection renewal.
They are never logged, listed or stored in browser storage.
