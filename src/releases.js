export const RELEASE_NOTES = [
  { number: "14", title: "Steady scoped accuracy", changes: ["Moving and jumping no longer reduce accuracy while aiming through a sight or scope.", "Scoping immediately removes movement spread; firing spread still follows each blaster’s stats."] },

  { number: "13", title: "Your controls, your way", changes: ["Customize keyboard and mouse bindings with two bindings per action, or restore the defaults.", "Control hints follow your saved bindings."] },
  { number: "12", title: "The egg studio", changes: [
    "Choose your look with image tiles showing the actual 3D cosmetics and a larger outfit preview.",
    "24 shell colors, 20 headwear styles, 10 patterns, 4 finishes and 6 eyewear styles—all unlocked.",
    "Choose an accent color, shuffle your look or reset it. Styles save and appear in multiplayer."
  ] },
  { number: "11", title: "Your yard, on the same link", changes: [
    "Browser approval, single-use activation codes, and the owner dashboard now work on the GitHub Pages address.",
    "Browse public matches or keep a room private, with access and matches managed by the game service."

  ] },
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
