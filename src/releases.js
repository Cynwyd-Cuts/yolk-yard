export const RELEASE_NOTES = [
  { number: "36", title: "Server-connected multiplayer", changes: ["Public listings, room codes, and match messages now use secure WebSockets through the shared game server.", "Arena and Yolk Royale retain their existing game rules, chat filtering, and host transfer. Direct player-to-player connections are no longer needed for the default online mode.", "Refresh before joining a new room. Connection reports now check the game server and shared directory."] },
  { number: "35", title: "A fresh idle every time", changes: ["The home egg starts easing into idle as soon as cursor movement stops and returns to face the camera directly, including after a manual spin.", "Eight shuffled idle animations cycle without consecutive repeats: low hold, high hold, inspection, reload, cartoon toss-and-catch, cradle, stretch and presentation.", "Cursor aiming interrupts every pose smoothly. Blaster flight, rotation, hands and reload parts ease back into place without changing gameplay ammunition."] },
  { number: "34", title: "An egg with personality", changes: ["The home-screen egg follows the mouse horizontally and vertically. Rotate it with a two-finger drag or twist.", "Two relaxed blaster holds alternate roughly every ten idle seconds, with gentle sway and breathing. Aiming, spinning and returning to idle blend smoothly, with hands staying on the blaster."] },
  { number: "33", title: "Smooth stairs and better controls", changes: ["Consistent stair contact, controlled step-downs and a smoothly eased camera remove stair jitter in arenas and Yolk Royale, including player-built stairs.", "Rebuilt keybind editor with primary and secondary slots, automatic reassignment of occupied inputs, mouse and scroll support, searchable actions, clear controls, Apply, Discard and confirmed default reset.", "Unsaved bindings stay in a draft; closing asks you to Apply or Discard. Escape remains available for the menu. Updated movement clients use compatible rooms."] },
  { number: "32", title: "One place to Play", changes: ["Choose Yolk Royale, Free for all or Team scramble from a single Play menu, with public matches, custom rooms, local bots and room codes together.", "Removed the left-side Loadout shortcut. New matches fill empty contestant seats with bots by default."] },
  { number: "31", title: "Harvest, build and edit in Yolk Royale", changes: ["Carry five items plus a permanent sixth-slot pickaxe. Harvest wood, brick and metal from destructible island scenery; aim for weak points for a faster harvest.", "Build walls, floors, stairs and roofs with grid previews, material costs, rotation, section editing, repairs and support collapse. Structures block movement and shots and take weapon damage.", "A new resource bank, blueprint selector, edit grid and six-slot hotbar bring building controls to keyboard and touch. Materials, world destruction and builds sync across the room and host transfers."] },
  { number: "30", title: "Names belong in the yard", changes: ["Ordinary names are allowed in chat, player profiles and public room listings, including names that also refer to places.", "Contact details, addresses, explicit private-detail disclosures and inappropriate language remain filtered."] },
  { number: "29", title: "Try a server connection", changes: ["A separate server check tests HTTPS access, secure WebSocket opening and three server replies without a room code.", "Open it from Check connection and copy the results. Multiplayer still uses its existing connections."] },
  { number: "28", title: "Arena streak power-ups", changes: ["Every five consecutive eliminations earns a random bonus in Free for all and Team scramble: Hard Boiled, Egg Breaker, Restock, Overheal, Double Eggs or Mini Egg.", "Stack bonuses, extend timed powers with eliminations, and track shield, timers and eggs on the HUD. Mini Egg shrinks your model and hitbox.", "Bonuses reset on death and respawn, sync in multiplayer and survive host transfers. Battle Royale has no streak bonuses."] },
  { number: "27", title: "Connection reports without developer tools", changes: ["Check matchmaking and public discovery from the home screen or connection errors.", "Room joins record data-channel and host-handshake progress. Copy a report without names, room codes, IP addresses or credentials.", "Directory reports distinguish remote responses from this browser acting as coordinator; empty results do not prove remote connectivity."] },
  { number: "26", title: "Smarter eggs, lasting rooms", changes: ["Easy, Normal, Hard and Impossible bots use adaptive routes, cover, varied aim and situational sidearms and poppers. Bots wear randomized outfits; new players start plain.", "Hosting transfers to the next player when the host leaves. Humans replace bots in filled matches, empty seats refill, and duplicate names must be changed.", "Chat stays on screen. Inventory opens on the right with actual item images, drag reordering, split/drop controls and detailed inspection. Directional red damage cues and a stronger waddle improve feedback.", "Long-range projectile hits, empty-slot aiming, wall collisions, and per-shot damage totals are corrected. Verified projectile speeds apply in every mode; Thumper rockets and popper grenades have new visuals.", "The three modes are Yolk Royale, Free for all and Team scramble. Arena maps gain connected upper routes. Royale has spaced loot, smaller chests, connected optional stairs, positional sounds, a kill feed and a storm that ends only with the last survivor.", "Victory and placement banners appear before the scoreboard. Public matches are the default."] },
  { number: "25", title: "Sunnybreak rebuilt", changes: ["A much denser island: 92 buildings, 560 trees, rolling terrain, distinct district architecture and hundreds of detailed props.", "Rebuilt Eggspress, curved gliders, treasure and supply chests, ammo and every utility item. Ground loot uses full blaster models; Peeper, Double Yolk and Comet have distinct new designs.", "Royale sprint now matches normal-mode movement speed; walking is slower. Footsteps and button-hover sounds are removed; button clicks retain feedback.", "Reset any sensitivity, field-of-view or audio slider—or reset all sliders. Press I or M again to close inventory or map; custom bindings work too."] },
  { number: "24", title: "Expanded chat and name filtering", changes: ["Merged both supplied profanity lists and canonical forms: 3,717 unique terms, with duplicates removed.", "The expanded filter applies to chat and player names, with checks for disguised spellings and safe word boundaries."] },
  { number: "23", title: "Yolk Royale: last egg standing", changes: ["Drop from the Eggspress onto Sunnybreak, a 512 × 512 island with nine districts, chests and floor loot.", "Public matchmaking, private rooms and bot matches support 16 contestants, five inventory slots, eleven blasters and eight utility items.", "Skydive, deploy your glider, sprint with stamina, mark the map and outrun eight storm stages. Eliminated eggs spectate until the rematch.", "Original sound bank adds positional combat, transport, wind, footsteps, loot, item use, shields, storm and victory feedback, with separate sound controls."] },
  { number: "22", title: "Good eggs, safer conversations", changes: ["Room, team and spectator chat with quick messages, desktop shortcuts and touch controls.", "Always-on filtering for chat and player names, including disguised language, common personal details and real-name/location detection.", "Mute players, choose quick messages only or turn chat off; report to the host, who can silence players or pause room chat.", "Host-enforced spam limits and independent recipient checks; chat clears when you leave the room."] },
  { number: "21", title: "Your look, from shell to fingertips", changes: ["Arms and hands now share your shell color, pattern, accent and finish in first person and multiplayer.", "The Egg Studio outfit preview shows your complete egg with arms and hands; option tiles still isolate their own category.", "Appearance changes, resets, reloads and weapon switches keep the full style consistent."] },
  { number: "20", title: "Sculpted hands and smooth switches", changes: ["Redesigned arms with smooth bends, fuller forearms and tapered wrists instead of sticks and ball joints.", "Larger sculpted hands have four curled fingers, defined palms and opposing thumbs for a more convincing grip.", "Kept every blaster’s aiming, firing and reload animations in first person and multiplayer.", "Blasters lower before switching and rise into a weapon-specific grip when drawn, with synchronized handling and clean rapid-switch transitions."] },
  { number: "19", title: "Hands on every blaster", changes: ["Shell-colored cartoon arms and hands use a different grip for every blaster.", "Distinct reload hand motions and moving ammo pieces follow the actual reload timer in first person and on other players.", "Arms follow aiming and firing, and reset cleanly when a reload ends or is cancelled."] },
  { number: "18", title: "More reliable shell hits", changes: ["Hitboxes cover the animated shell, with centered waddling and less visual lag on moving eggs.", "Clear shots over ledges retract the muzzle safely; close-range shots register even when starting inside a shell."] },
  { number: "17", title: "Plain shells and focused previews", changes: ["Choose No pattern, No headwear, or No eyewear; Reset appearance returns to a plain egg.", "Cosmetic image tiles show only their own category. The large preview keeps your complete outfit."] },
  { number: "16", title: "Your match, your rules", changes: ["One Create Match flow for public or private matches with configurable bots.", "Edit arena, mode, time limit, score target and bot difficulty in the lobby and before every rematch."] },
  { number: "15", title: "Open the yard", changes: ["Open the game directly without login, browser approval or activation codes.", "Restored invite-code multiplayer and local bot practice. Kept the public-match directory and public/private room controls without an access dashboard."] },
  { number: "14", title: "Steady scoped accuracy", changes: ["Moving and jumping no longer reduce accuracy while aiming through a sight or scope.", "Scoping immediately removes movement spread; firing spread still follows each blaster’s stats."] },

  { number: "13", title: "Your controls, your way", changes: ["Customize keyboard and mouse bindings with two bindings per action, or restore the defaults.", "Control hints follow your saved bindings."] },
  { number: "12", title: "The egg studio", changes: [
    "Choose your look with image tiles showing the actual 3D cosmetics and a larger outfit preview.",
    "24 shell colors, 20 headwear styles, 10 patterns, 4 finishes and 6 eyewear styles—all unlocked.",
    "Choose an accent color, shuffle your look or reset it. Styles save and appear in multiplayer."
  ] },
  { number: "11", title: "Your yard, on the same link", changes: ["Added public-match browsing and room visibility controls on the GitHub Pages address."] },
  { number: "10", title: "Crosshairs that show your accuracy", changes: [
    "Crosshair arms widen with movement and firing spread, then settle as accuracy recovers.",
    "The indicator uses the match host’s actual weapon spread in practice and multiplayer."
  ] },
  { number: "09", title: "Crosshair preferences and ordered updates", changes: [
    "Center Dot and Hit Markers can be switched independently, both enabled by default.",
    "Release history is numbered consecutively; failed builds and retries no longer skip numbers."
  ] },
  { number: "08", title: "Readable damage at every distance", changes: [
    "Damage numbers keep the same screen size at every distance, with distinct critical-hit styling."
  ] },
  { number: "07", title: "Clearer hits and simpler controls", changes: [
    "Damage numbers are 60% larger, with distinct gold critical hits.",
    "Desktop play always uses mouse lock; removed the drag-to-look setting.",
    "New private rooms start with zero bots selected.",
    "The quality update button automatically follows every published build."
  ] },
  { number: "06", title: "A smoother yard, on your terms", changes: [
    "Automatic update refresh in the menu and lobby; active matches wait until you leave.",
    "Click the quality update button to read numbered release notes.",
    "Smooth egg shells and a slower, wider, continuous waddle.",
    "Adjust scope sensitivity separately in Settings, for mouse and touch aiming.",
    "Choose Enter the Yard to spawn, and Respawn after each elimination."
  ] },
  { number: "05", title: "Weapon tuning and spectating", changes: [
    "Revised weapon stats, accuracy, ammunition and reload behavior.",
    "Pause-menu respawn and spectator mode with player switching.",
    "Improved floating damage numbers and critical-hit feedback."
  ] },
  { number: "04", title: "Egg movement and weapon polish", changes: [
    "Full ammo reserves leave ammo pickups available.",
    "Distinct projectile shapes and trails for each weapon.",
    "Compact, closed Thumper model and legless egg movement."
  ] },
  { number: "03", title: "Shell damage and hit feedback", changes: [
    "Shell cracks show damage, with a defeat animation and sound.",
    "Watch your opponent after an elimination and see their stats.",
    "Center hits receive a modest bonus with floating damage feedback."
  ] },
  { number: "02", title: "Quality update", changes: [
    "Improved weapon models, model previews and working optic views.",
    "Expanded arenas and traveling projectiles fired from weapon muzzles."
  ] }
  ,{ number: "01", title: "Welcome to Yolk Yard", changes: ["The original arenas, blasters, practice matches and private multiplayer rooms."] }
];
export const RELEASES = typeof __RELEASE_HISTORY__ !== "undefined" ? __RELEASE_HISTORY__ : RELEASE_NOTES;
export const RELEASE = RELEASES[0].number;
