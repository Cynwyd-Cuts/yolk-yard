# Yolk Royale — implementation design

Design locked before implementation, 21 September 2026. A complete solo, no-building battle royale inside Yolk Yard, with original art, island, item names, transport and sound. The familiar loop is airborne insertion → loot → rotate with the storm → survive → spectate → rematch.

## Product and round contract

- Dedicated Battle Royale entry on the home screen, plus Battle Royale in Create Match. Existing arena modes retain their rules and loadouts.
- Up to 16 contestants. Public quick play fills empty contestant seats with bots; private rooms choose 0–15 bots and 2–16 contestant capacity. At least two contestants are required to launch. Bot difficulty is configurable.
- All contestants start with 100 shell health, zero shield, five empty slots, no reserve ammunition, and a reusable glider. Lobby loadouts never become starting equipment.
- One life, no automatic healing, no respawns, no joining a running round as a contestant. Last living egg wins. Storm damage bypasses shield. Simultaneous final eliminations resolve as a draw, not an arbitrary winner.
- Player state: lobby → transport → dive → glide → grounded → eliminated/spectating. Launch pads can return grounded players to glide. A fresh rematch resets inventory, storm, chest state, drops, placements and stamina.
- Round state: waiting lobby → flight (35 seconds, exits enabled after 3 seconds) → survival with eight storm steps → results. The host owns all state transitions. All players on board are automatically dropped at the route end.

## Matchmaking and room lifecycle

- Public Quick Play queries the existing browser-coordinated room directory for compatible-version, waiting Royale rooms with room for a human. Prefer fuller rooms, tie-break by room code. Retry stale/full candidates, recheck once after a short randomized contention delay, then create a public waiting room if none works.
- Queue hosts start a 30-second countdown. New humans replace future bot seats. Capacity can start the round early. Bot fill targets capacity; it does not add 15 bots on top of humans. The automatic countdown waits while the host edits settings.
- Public custom rooms remain host-started. Private rooms never publish their code to the directory. Hosts can switch visibility before or during play; switching does not change the locked round roster.
- Late invitees can occupy up to four spectator seats after launch. They receive the current world, follow living players, and become contestants in the next lobby if capacity permits. Public matchmaking never intentionally places a player into a running match.
- Leaving during survival counts as elimination and drops carried equipment; disconnect cannot reset health. Rejoining is a new spectator. A eliminated player cannot turn profile updates, rejoin, spawn, or round actions into a respawn.
- Guests cannot start rounds, change rules, spawn loot, open distant chests, grant ammo, change health or select invalid slots. Inputs are sanitized, sequenced and rate limited; host validates interaction distance and line of sight. Chest opening and pickup arbitration happen serially on the host, so only one player receives a drop.
- The current deployment uses GitHub Pages + PeerJS/WebRTC and a host browser, not dedicated servers. Host departure ends the room with an explanation; no false reconnect or host migration promise. Signaling failure offers an explicit local match. There is no account gate, ranked queue, paid infrastructure, or claim of 100-player capacity.
- Protocol version changes isolate older clients. Existing update detection refreshes the lobby while allowing current games to finish.

## Island: Sunnybreak, 512 × 512 world units

Approximately 41 times the ground area of The Yard. North is negative Z. Sea surrounds a walkable island. Main roads connect districts; small cover and cabins break long exposed crossings. Buildings use collision-matched walls, open doors, roof decks and accessible stairs. No decorative wall may block a doorway without collision.

| District | Center X/Z | Role / landmarks |
| --- | --- | --- |
| Shellside Square | 0 / 0 | Central plaza, market awnings, clock tower, highest contest density |
| Cornflake Fields | -145 / -140 | Farm barns, crop rows, silos, hay cover |
| Sunny Docks | 150 / 135 | Cargo stacks, warehouses, cranes, waterfront |
| Scramble Springs | 145 / -135 | Pools, bright cabins, fountain, quick rotations |
| Crater Camp | -145 / 135 | Observatory camp, stone rings, expedition tents |
| Perch Park | 0 / -185 | Orchard groves and picnic shelters |
| Toast Town | 0 / 175 | Small street of colorful houses and rooftop cover |
| Hatchery Heights | -190 / 0 | Raised hatchery platform, stairs, glasshouse shapes |
| Yolkworks | 190 / 0 | Factory yard, pipes, cooling towers |

- Distributed guaranteed chest and floor-loot anchors: every major district has multiple weapons and consumables. At least one weapon + ammo + utility/heal comes from every chest.
- Seeded loot and flight direction change every round. Loot uses authored reachable anchors; chests are never buried inside collision geometry.
- Coarse cached navigation and local obstacle steering suit the larger world. Static scenery is merged by material; faraway loot and labels are culled; no physics on every decorative leaf.

## Flight and movement

- Eggspress: a gold yolk balloon lifting a teal egg-carton gondola, animated rotors, suspension cables and a trailing pennant. A seeded route crosses the island; route and current transport position appear on both maps.
- Space / Jump exits after the short ready period. In freefall, WASD steers and diving descends quickly. Space deploys the shell glider; gliding trades vertical speed for travel. Automatically deploy at 24 units above the collision surface. Once low, the glider cannot be cut; land safely on roofs or ground.
- Ground movement: existing aim/collision/jump behavior. Shift sprints with a 100-point stamina bar, drains 22/sec, regenerates 18/sec after 1.3 sec without sprinting, and requires 20 stamina after exhaustion. Cannot sprint while aiming, firing or consuming. Sprint cancels healing. No fall damage during insertion or a launch-pad glide.
- Shift's old secondary aim binding is migrated so sprint and aim cannot conflict. Controls expose remappable interact, sprint, map, inventory, drop, and slots 3–5 in addition to existing bindings. Right click remains aim.
- Desktop wheel cycles five slots, 1–5 selects, F interacts, X drops, M opens map, I opens inventory. Mobile has equivalent touch actions and a tappable hotbar.

## Inventory, equipment and interaction

- Five ordered slots hold weapon instances or capped consumable stacks. Empty hands are valid and cannot fire an implicit default weapon.
- Pickup puts equipment in an empty slot or adds to a matching stack. A full inventory replaces the selected slot, dropping the old item. X drops the selected stack. Inventory panel permits select, swap and drop. No inventory operation duplicates ammunition.
- Ammo is shared by type (light, medium, shells, heavy, rockets), capped, and collected automatically at short range. Loaded rounds remain with a dropped weapon; reserve ammunition drops separately on elimination. Reload atomically moves reserve into the selected magazine; switching or using an item cancels the reload.
- Five rarity levels: common, uncommon, rare, epic, legendary; readable color plus text and stars. Rarity modestly changes damage/reload. Arena weapon statistics remain unchanged. Royale gun ranges are adjusted for the larger island without making rifles instantaneous hitscan.
- Base arsenal includes seven primaries and Pip. Additional Royale-only weapons: Peeper precision repeater, Double Yolk tactical scatter, and Comet energy carbine, using original procedural models and their own weapon data.
- Other items: Bandage (small capped heal), Medkit (full heal), Mini Shield (25, capped at 50), Shield Flask (50, capped at 100), Splash Egg (nearby health then shield), Popper stack (timed projectile), Impulse Egg (mobility burst), Launch Nest (places reusable launch pad).
- Item use shows progress and a matching hand animation. Moving too fast, changing slot, dropping or taking damage interrupts timed use without consuming the item. Item is consumed only on successful completion. Full health/shield refuses use.
- F holds a chest open for 0.8 seconds; releasing, moving away, damage or obstruction resets progress. An opened chest stays open. Ground items bob/rotate and carry rarity auras. The pickup prompt names the item, rarity and replacement rule.
- Periodic supply drops are visible on the map and descend on a little canopy, offering higher-rarity equipment after landing.

## Storm and endgame

- Host-generated nested safe circles. Each new center lies inside the previous circle with its entire target radius contained. Eight stages alternate warning/wait and closing, with rising health damage. All players receive identical center, radii, phase and countdown.
- Initial radius covers the island during insertion. First reveal gives looting time. The final circle collapses to zero, then increased damage guarantees termination. Timings can be Normal or Quick in custom matches, without a kills-to-win target.
- Animated translucent storm wall, ground ring, purple outside-storm tint, audible notices, warning banner, distance to safety, minimap and full-map overlays. Damage is tick-rate independent and does not accidentally hit passengers before survival begins.
- Full map: named locations, terrain/structures, safe and next circles, flight path, supply drop and personal waypoint. Click/tap places waypoint; clear removes it. HUD shows direction and distance; world beam marks it. Maps do not reveal opponents.

## Elimination, spectating and results

- Elimination drops all equipment and reserves once, records placement as current alive count, credits eligible attacker, interrupts use/reload and locks the player out of combat.
- Start spectating the eliminator if still alive, otherwise the next living contestant. Previous/Next cycles only living contestants; automatically switch when a target leaves or is eliminated. Follow camera respects collision; show target health/shield, inventory, eliminations and alive count. No free-camera advantage for living players.
- No Respawn/Rejoin/Loadout button is offered in a running Royale round. Spectators may leave, view map, adjust settings, or wait for results. Host can still host after elimination.
- Winner animation, Victory Yolk banner, placement, eliminations and round results. Rematch returns through editable setup for the host and resets all state for guests; public Quick Play is available from results as a separate fresh queue.

## Animation and feedback coverage

- Transport rotors/balloon sway, exit, spread-limb diving, deployed canopy and suspension lines, landing squash, walk/sprint gait, jump, weapon recoil and reload hands, item use, throw, pickup float/rarity pulse, opening chest lid/golden burst, falling supply parachute, expanding impulse ring, launch pad pulse, moving storm, hit/shield feedback, elimination dissolve, winner celebration.
- Animation derives from replicated state/time so spectators see the same action. Lightweight procedural original assets keep downloads small. Reduced quality cuts shadows and detail without changing game logic.

## Implementation boundaries

- `royale-map.js`: independent map/loot anchors and island layout.
- `royale-data.js`: item definitions, rarity, storm tuning, flight and matchmaking helpers.
- `royale.js`: authoritative Royale simulation using the proven projectile/collision engine.
- `royale-view.js`: island art, transport, gliders, items, chest/supply/storm animation.
- `royale-ui.js`: minimap/full map, hotbar, inventory, contextual prompts.
- Small integration points in existing main/network/physics/data/view; arena regressions must pass.

## Required verification before publishing

1. Deterministic round start, clean inventories, bot fill/capacity, no respawn exploits, roster lock, late spectators and rematch reset.
2. Flight ejection, forced exit, glider deploy/landing on surfaces, stamina drain/recovery/exhaustion.
3. Every loot anchor is reachable; simultaneous chest/pickup has one winner; full-slot replacement/drop; ammo caps and reload cannot duplicate rounds; canceled/full-stat use does not consume.
4. Nested storm circles, shield bypass, phase timing, consistent damage at fixed ticks, last survivor and simultaneous final elimination; disconnect elimination.
5. Bot looting/rotation/combat through a complete seeded round; simulation performance with 16 contestants and projectile/loot load.
6. Real two-client WebRTC: public discovery/queue, private invisibility, roster/flight/loot/storm synchronization, late spectating, rematch and host departure. Existing arena browser regression.
7. Desktop and mobile visuals for lobby, transport, island, HUD/inventory/map, chest, storm and spectator/results. No overflow, console exceptions or broken input paths.
8. Production build, ordered release notes/update manifest, GitHub Pages workflow and live release verification. Record actual checks and limitations; never label an untested full-capacity internet lobby as load-tested.

## Sound expansion — added before implementation

User requested extensive sound coverage for every game part. Original Web Audio synthesis and seeded noise, no copied audio clips. Layered sound families cover UI hover/select/back/error, queue/countdown/start, transport engine/rotor/horn, dive wind, glider deploy/flap/cut, jump/land, walk/sprint steps on grass/stone/wood/metal/water, stamina exhaustion/recovery, each weapon's shot/tail/casing/empty/swap and magazine-out/in/bolt, distant shots, projectile flyby/impact/ricochet, shield hit/break, health hit, chest hum/open, rarity pickup/ammo/drop, every consumable/use/cancel, gadget impulse/launch, supply incoming/canopy/landing, storm reveal/closing/entry/exit/ticks/ambience, elimination/spectator switch/top-ten/final-duel/victory/defeat. Persistent loops crossfade by player state and stop on leaving. Spatial effects attenuate and pan relative to the listener, with voice caps and cooldowns to prevent a loud overlapping wall of sound. Master/effects/ambience/music volumes and mute are saved settings. Browser audio starts only after a user gesture. Unit checks use a fake AudioContext to verify every cue remains finite, loop cleanup, gain limits and mute behavior; browser checks verify unlock and no AudioContext exceptions.

## Verification refinements

- Match transport uses PeerJS binary serialization, which fragments large snapshots; the JSON serializer rejects messages over approximately 16 KB and cannot carry the full island. World loot is versioned and sent again only when it changes.
- Inventory panel operations are ordered host commands, so a movement packet cannot overwrite a one-frame swap/drop.
- Airborne motion uses world collision and launch impulses rise physically before gliding. Decorative solid landmarks have authored collision footprints.
- Original sound inventory: 79 named cues, eleven blaster palettes and five environment loops.

## Sunnybreak refresh (release 25)

The subsequent user-requested refresh supersedes the original movement and sound choices: walking is 5.0 units/sec, sprinting is 7.4 (arena movement speed), footsteps and hover cues are removed, and the remaining bank contains 73 cues. Seven sliders have individual resets plus reset-all. I/M and customized panel bindings toggle their panel closed or switch between map and inventory.

The expanded island has 92 buildings, 560 trees across five vegetation families, over 200 authored props and real heightfield terrain. Eight architectural families across nine districts include timber/gabled buildings, industrial sawtooth roofs, villas, shopfronts and greenhouse frames. Rendering, collision, projectile intersections, navigation and map shading share the terrain. Collectibles use full blaster models and distinct utility models; the airship, glider, chests and supply crates are rebuilt. See `ROYALE_ART_REFRESH.md` for the scoped plan and verification requirements.
