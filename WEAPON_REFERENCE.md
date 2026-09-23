# Weapon reference

Projectile speeds reverified on 2026-09-23 (other constants verified 2026-09-21) against the live public client served by
https://shellshock.io/ (`js/shellshock.js?1788294560`). These are numeric gameplay
facts, implemented in Yolk Yard's own simulation. No reference-game code, models,
textures, audio, or other assets are included.

| Yolk Yard | Shell Shockers class | Max damage per projectile | Magazine | Reserve | Pickup | Shot interval (s) | Tactical reload (s) | Empty reload (s) | Reference range constant | Speed (units/s) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Sprinter | EggK-47 | 30 | 30 | 240 | 30 | 0.1 | 2.667 | 3.433 | 20 | 45 |
| Scatter | Scrambler | 8.5 × 20 pellets | 2 | 24 | 8 | 0.267 | 2.6 | 2.6 | 8 | 30 |
| Needle | Crackshot | 170 | 1 | 12 | 4 | 0.5 | 2.4 | 2.4 | 60 | 60 |
| Zipper | Whipper | 23 | 40 | 200 | 40 | 0.067 | 3.167 | 3.767 | 20 | 37.5 |
| Thumper | RPEGG | 140 | 1 | 3 | 1 | 1.333 | 2.833 | 2.833 | 45 | 12 |
| Anchor | Free Ranger | 105 | 15 | 60 | 15 | 0.433 | 2.767 | 3.767 | 50 | 52.5 |
| Duet | Tri-Hard | 32 | 24 | 150 | 24 | 0.5 between bursts | 2.667 | 3.433 | 20 | 45 |
| Pip | Cluck 9mm | 26 | 15 | 60 | 15 | 0.133 | 2.667 | 3.267 | 15 | 30 |

The reference simulation runs at 30 Hz. Fire intervals use reference ticks / 30;
reload counters decrease by two per tick, so effective reload duration is
ceil(counter / 2) / 30. Table values are rounded for readability; definitions
retain precision. Only EggK-47 and Whipper are automatic. Tri-Hard fires three
shots 0.1 seconds apart. Anchor was formerly an original heavy automatic class;
it now fills the Free Ranger slot. Existing profile IDs are preserved.

Spread base, maximum, shot bloom, recovery, aiming multiplier, and movement
multiplier are recorded in `src/data.js` for every weapon. Recovery runs at
30 Hz, including the eight-tick recovery delay after firing. Bullet and rocket
trajectories have no gravity. RPEGG radius is 2.75, arming distance is 3. Grenade
maximum damage is 150, radius 3, and fuse 2.5 seconds.

The bullet damage factor uses incidence against the egg surface: with incidence
cosine c, b = 0.2 + 0.8c and factor = b^(4+b^4). The previous flat 15% bonus and
extra shotgun distance penalty are removed. Damage labels still report actual
health removed, capped by remaining health.

## Exactness limits

The public client does not expose the authoritative server's explosion falloff,
self-damage, and occlusion calculation. Yolk Yard retains its own rules for those
while using the verified maximum damage, radius, and arming distance. These must
not be described as verified identical to Shell Shockers.

World units are used directly in Yolk Yard. Egg geometry, muzzle alignment,
movement, spread sampling, scope presentation, grenade bounce physics, and
network simulation remain Yolk Yard implementations. Movement bloom is normalized
to Yolk Yard's movement speed. There are no class-specific movement penalties.
Thus the recorded weapon constants match the public client, but the complete
cross-engine gameplay is not a frame-for-frame replica. Shell Shockers cosmetic
recoil animations and scope transitions are not copied.

Protocol version is raised to 10 so clients using the earlier balance cannot join
updated hosts. The existing main-branch workflow tests and deploys GitHub Pages.

Yolk Yard intentionally removes movement and jumping bloom while aiming, including
accumulated movement bloom when entering a scope. Firing bloom and reload instability
remain. This scoped movement rule is a custom gameplay choice.


The reference range constant is not an unconditional projectile lifetime: the live
client extends shots to world intersections. Previously Yolk Yard incorrectly
expired rifle rounds after 20 units. Separate finite travel limits now cover long
sight lines (320 units for standard rounds, 600 for scopes, 65 for pellets and 180
for rockets), with swept character/world collision on every segment. Royale no
longer overrides the verified velocities with a shared minimum of 110 units/s.
Original Royale-only blasters inherit their reciprocal base class velocity.
