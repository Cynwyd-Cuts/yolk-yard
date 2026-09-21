# Sunnybreak art and controls refresh

Implementation plan, agreed scope: retain existing public/private matchmaking, authority, inventory, storm and spectating. Preserve arena gameplay and current chat protections.

## Controls and sound

- All seven settings sliders get individual Reset buttons and a Reset all sliders action. Defaults come from one shared definition; reset persists immediately without changing keybinds, appearance or privacy.
- Remove walking/running footsteps and button-hover audio completely. Button activation retains its select cue. Keep landing, glider, combat, environment and item feedback.
- Royale walk: 5.0 world units/sec; sprint: 7.4 (normal arena speed). Keep stamina and aim modifiers. Flight speed is unchanged.
- I/M, including rebound keys, toggle their own panel closed and can switch between panels. Ignore auto-repeat, text entry and unrelated dialogs. Closing restores gameplay and requests pointer lock from the key gesture.

## Art direction and world

- Nine districts become recognizable by silhouette: shopfronts and clock plaza, timber barns and silos, port warehouses and cranes, resort villas and pools, expedition huts, park lodges, hatchery conservatories, industrial workshops and seaside houses.
- Expand from 38 buildings toward 80+, and from sparse canopies to hundreds of broadleaf, pine, palm, orchard and autumn trees. Add satellite settlements, fences, gardens, field rows, lamps, benches, barrels, rocks and roadside equipment.
- Author terrain as a shared sampled heightfield, flattened around roads and structures. Rendering, movement, projectile collision, loot, map shading and bot navigation use that same surface. District access, wide doors, usable roofs and chest approaches remain clear.
- Detailed new loot assets: actual blaster models, unique utility silhouettes, ammo packages, hinged treasure chests, supply crates, launch pads, ribbed gliders and a rebuilt Eggspress airship. Peeper, Double Yolk and Comet get their own models, not modified arena duplicates.
- Batch static scenery by material and spatial chunk, share reusable geometry/materials and distance-limit dynamic loot. No per-tree lights or unbounded effects.

## Verification and publication

- Unit checks: default resets; silent movement; speed equivalence; terrain sampling/rays/landing; map density; every loot anchor clear; model-family coverage; existing simulation, networking, moderation and combat regressions.
- Real-browser checks: slider persistence, keyboard open/close/switch, click-only audio, desktop and mobile layouts, district/asset screenshots, complete local Royale loop.
- Multiplayer browser regression in CI, production build, pull request, publish to existing GitHub Pages URL and verify deployed build identifier.

## Implemented and checked locally

- 92 buildings, 560 trees, five foliage families, more than 200 props; all retained chest/floor-loot anchors checked against solid architecture.
- Shared heightfield reaches eight units, with flat structure approaches and roads. Terrain rays, walking and glider landing agree in unit tests.
- 91 unit/regression tests passed, including a complete seeded 16-contestant bot round: 12 contestants found weapons and the round finished with valid placements.
- Visual gallery covers all nine districts, every collectible family and the transport. Static district views measured 31–132 draw calls after vertex-color/spatial batching (the first unoptimized port view exceeded 1,100). This is a rendering-work measurement, not a device FPS guarantee.
- Production compilation succeeds. The automated local/browser and CI checks remain release gates; final results are recorded in their test reports.
- Network protocol 9 and a protocol-scoped directory prevent older island/collision clients from mixing into new matches. Private invites retain the existing explicit refresh/version-mismatch response.
