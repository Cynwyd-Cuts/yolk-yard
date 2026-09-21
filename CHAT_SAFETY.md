# Chat safety design

## Data flow and trust

1. The sender moderates a complete submission before sending. Never send keystrokes, drafts, rejected originals or analytics. Quick messages use fixed IDs.
2. The host accepts chat only from admitted human connections. Sender identity and team membership come from the simulation, not packet fields. The host validates protocol, length, channel, language, PII, recent context, rate and silence state.
3. The host sends each approved message only to its authorized audience. Team messages are not broadcast to opponents. Active spectators cannot message live competitors. Quick IDs resolve to canonical text.
4. Each recipient verifies sender membership, audience, sequence, payload and moderation independently. A malicious host’s unsafe message is not trusted. UI renders text nodes, never message HTML.
5. Names pass the same policy in saved profiles, simulation, directory listings, received rosters, historical events and result headlines. Only safe strings enter the small name/system-text caches.

## Policy

- Obscenity 0.4.6 provides the English phrase dataset, allowlists and normalization for profanity/slurs; additional family-friendly terms and harassment rules extend it.
- Unicode normalization, invisible-character removal, confusable folding, compact forms and repeated-letter/leet handling address disguised words. Encoded markup, unsupported scripts, excessive length and malformed values fail closed.
- Privacy patterns detect email/handles/links, contact services, long numeric and spelled-number sequences, addresses, coordinates, account/financial identifiers, ages and personal-information disclosures or requests. Compromise’s local English entity recognizer adds common people and places, including camel-case names.
- A short recent-message window checks disclosures or words split across consecutive messages from one sender. It contains approved text only, not rejected originals.
- A blocked message is withheld entirely with a generic local explanation. No hidden raw copy, unsafe preview, filtered-content tooltip or moderation API key is shipped.

## Controls and lifecycle

- Maximum 180 characters; minimum one second between host-admitted attempts; at most five attempts per ten seconds; duplicates rejected within twenty seconds. Four moderation failures in sixty seconds impose a thirty-second cooldown.
- Per-player muting, quick-only and off modes are enforced before display. Host silences are scoped to the room; hosts can pause chat and remove players. Removed peer IDs cannot immediately rejoin the same host session. Anonymous fresh identities can evade room-only bans.
- Reports use three fixed reasons, verify both participants, deduplicate reporter/target pairs and notify the current host. Reporting also mutes locally. No central moderation queue is implied.
- Messages are capped at sixty per recipient, live only in memory, and clear when leaving. No history is sent to late joiners. Preferences are saved locally, while mutes and reports are room-scoped. Same-room rematches keep the conversation.
- Opening chat clears pressed keys, pending actions and touch controls, then releases the pointer. The world keeps running in multiplayer while gameplay input is neutral. Closing chat resumes pointer capture when appropriate. Keybinds are configurable; touch users have a visible button.
- Protocol 6 prevents old unfiltered clients from joining current hosts. Existing update refresh behavior updates lobby users and defers active-match refreshes.

## Accuracy and authority limits

This implementation does not provide Roblox’s proprietary service, contextual model coverage, language coverage, identity verification, human moderation, persistent global enforcement or dedicated-server authority. It cannot recognize all possible personal details or intentional encodings and may reject innocent ambiguous words. The strongest available local setting is quick messages only. Receiver filtering protects standard clients even when a host skips its checks; it does not constrain a modified client’s own display or make the player-hosted game tamper-proof.

Regression evidence lives in `tests/chat.test.js` and `scripts/chat-browser-check.mjs`, both included in the publishing gate. Add a non-identifying regression whenever changing a policy rule. Check false positives alongside blocked fixtures. Never use real personal details in test fixtures or logs.
