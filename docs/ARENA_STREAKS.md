# Arena streak bonuses

Only `ffa` and `teams` award a random bonus every five consecutive eliminations. All six outcomes have equal weight, can repeat, and can coexist. Bots follow the same rules. Death, manual respawn, and a new round clear powers. The host owns awards, damage and expiry; snapshots and migration checkpoints carry the state. Royale is excluded.

- Hard Boiled: 100 non-regenerating shield; excess damage reaches health.
- Egg Breaker: double damage for 15 seconds.
- Restock: full primary/sidearm magazines and reserves, three poppers, reload cancelled.
- Overheal: set health to 200, decay 10 HP/second to 100. Existing shield is stored while health exceeds 100.
- Double Eggs: 20 instead of 10 cosmetic egg points per elimination for 15 seconds. Eggs are local round-result statistics, not purchases or unlock requirements.
- Mini Egg: half-size model, hitbox, eye and aiming height for 15 seconds. Movement clearance remains full-sized to avoid trapping players when the timer expires.

Each elimination extends active timed powers by three seconds, capped at 15 seconds remaining. The triggering elimination receives the previous reward multiplier. No score-limit or team-score multiplier applies.

Reference: Blue Wizard's Into the Shadows update (https://bluewizard.com/3748-2/) confirms randomized bonuses. The Football Bros update (https://bluewizard.com/shell-shockers-update-the-football-bros-update/) confirms extensions for timed bonuses. The public Power-Ups reference (https://shellshockers.fandom.com/wiki/Power-Ups) describes the six effects and base durations. Precise random weights, overheal decay, extension/cap values and reset-edge behavior are not fully specified by the developer; those are explicit local implementation choices, not a claim of source-code parity. Original visuals and sounds are used.
