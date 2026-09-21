import "./style.css";
import { RELEASES, RELEASE } from "./releases.js";
import { UpdateWatcher } from "./updates.js";
import {
  WEAPONS,
  MODES,
  COLORS,
  HATS,
  gun,
  weapon,
  mode,
  safeProfile,
  clamp,
} from "./data.js";
import { MAPS, getMap } from "./maps.js";
import { movePlayer } from "./physics.js";
import { Simulation } from "./simulation.js";
import { Network, cleanCode, formatCode } from "./network.js";
import { View } from "./view.js";
import { Sound } from "./audio.js";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const read = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
      return fallback;
    }
  },
  save = (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {}
  };
let profile = safeProfile(
  read("yolk-profile", { name: "Player", weapon: "sprinter", hat: 1 }),
);
const settings = {
  sensitivity: 1,
  scopeSensitivity: 0.65,
  fov: 85,
  volume: 0.45,
  quality: "high",
  invert: false,
  centerDot: true,
  hitMarkers: true,
  ...read("yolk-settings", {}),
};
delete settings.dragLook;
save("yolk-settings", settings);
settings.sensitivity = clamp(Number(settings.sensitivity) || 1, 0.2, 3);
settings.scopeSensitivity = clamp(Number(settings.scopeSensitivity) || 0.65, 0.1, 2);
settings.fov = clamp(Number(settings.fov) || 85, 65, 110);
settings.volume = clamp(Number(settings.volume) || 0, 0, 1);
let stats = read("yolk-stats", { matches: 0, kills: 0, wins: 0 }),
  options = { map: "yard", mode: "ffa", bots: 4, difficulty: 2 };
let view,
  sim = null,
  net = null,
  state = null,
  screen = "menu",
  paused = true,
  dialogType = "",
  localId = "host",
  predicted = null,
  pendingInputs = [],
  seq = 0,
  lastEvent = 0,
  lastPhase = "",
  lastHealth = 100,
  roundSaved = -1,
  busy = false,
  scoreHeld = false,
  noticeUntil = 0,
  toastUntil = 0,
  hitUntil = 0,
  damageFlash = 0;
const sound = new Sound();
sound.volume = settings.volume;
const keys = new Set();
// Preserve brief actions until a simulation tick consumes them, even after a slow frame.
const queuedActions = new Set();
const input = {
  yaw: 0,
  pitch: 0,
  forward: 0,
  strafe: 0,
  jump: false,
  fire: false,
  aim: false,
  reload: false,
  popper: false,
  slot: 0,
};
const touch = {
  x: 0,
  y: 0,
  jump: false,
  fire: false,
  aim: false,
  reload: false,
  popper: false,
};
$("#app").innerHTML =
  `<div id="menu"></div><div id="lobby" hidden></div><div id="hud"><div class="scope" id="scope"><span id="scope-label"></span></div><div class="hud-top"><div class="match-label"><span id="hud-mode"></span><strong id="hud-map"></strong><span id="hud-network"></span></div><div class="match-center"><div class="score-pair"><b class="blue-score" id="score-blue"></b><b id="timer">5:00</b><b class="coral-score" id="score-coral"></b></div><small id="objective"></small></div><div class="hud-buttons"><button data-action="scores" aria-label="Scoreboard">Scores</button><button data-action="pause" aria-label="Pause menu">Ⅱ</button></div></div><div class="killfeed" id="feed"></div><div class="crosshair" id="crosshair"><i class="crosshair-arm left"></i><i class="crosshair-arm right"></i><i class="crosshair-arm top"></i><i class="crosshair-arm bottom"></i><span class="center-dot" id="center-dot"></span></div><div id="hit-marker" class="hit-marker" hidden></div><div class="hit-flash" id="damage"></div><div class="notice" id="notice"></div><div class="respawn" id="respawn"><div class="eyebrow" id="spawn-heading">SHELL DOWN</div><h2 id="spawn-status">Ready when you are</h2><button class="primary" id="spawn-button" data-action="enter-yard">Respawn</button><p class="small" id="respawn-by"></p><p class="small" id="spectator-stats"></p><button class="plain" data-action="loadout">Change loadout</button></div><div class="hud-bottom"><div class="health-card"><div class="health-label">SHELL <b id="health">100</b></div><div class="health-bar"><span id="health-fill"></span></div><div class="ammo-extra" id="streak">Freshly hatched</div></div><div class="quick-controls"><span><kbd>W A S D</kbd> Move</span><span><kbd>R</kbd> Reload</span><span><kbd>E</kbd> Popper</span><span><kbd>1 / 2</kbd> Swap</span><span><kbd>Esc</kbd> Menu</span></div><div class="ammo-card"><div class="eyebrow" id="gun-name"></div><div class="ammo-count"><b id="ammo">30</b> <span>/ <span id="reserve">150</span></span></div><div class="ammo-extra" id="ammo-extra"></div></div></div><div id="spectate-panel" hidden><div class="eyebrow">SPECTATING</div><p id="spectate-info"></p><div class="split-actions"><button data-action="spectate-prev">← Previous</button><button data-action="spectate-next">Next →</button><button data-action="rejoin">Join game</button></div></div><div class="scoreboard" id="scoreboard"></div><div class="mobile-controls"><div class="touch-stick" id="touch-stick" aria-label="Movement joystick"><span></span></div><div class="touch-look" id="touch-look" aria-label="Drag to look"></div><div class="touch-buttons"><button data-touch="jump">JUMP</button><button data-touch="fire">FIRE</button><button data-touch="reload">LOAD</button><button data-touch="aim">AIM</button><button data-touch="popper">POP</button></div></div></div><dialog id="dialog"></dialog><div class="toast" id="toast" role="status"></div>`;
const dialog = $("#dialog");
function remember() {
  save("yolk-profile", profile);
  if (sim) sim.setProfile(localId, profile);
  else net?.profile(profile);
}
function titleBar() {
  return `<div class="topbar"><div class="brand">YOLK<br><span>YARD</span></div><div class="top-actions"><button class="pill" data-action="updates">QUALITY UPDATE · ${RELEASE}</button><button class="icon-btn" data-action="help">How to play</button><button class="icon-btn" data-action="settings" aria-label="Settings">Settings</button></div></div>`;
}
function renderMenu() {
  const w = weapon(profile.weapon);
  $("#menu").innerHTML =
    `<div class="menu-shade"></div>${titleBar()}<main class="menu-layout"><section class="panel play-panel"><div class="eyebrow">GOOD EGGS. GREAT AIM.</div><h1>Time to<br>scramble.</h1><label class="name-label" for="player-name">YOUR NAME</label><input class="field" id="player-name" maxlength="18" value="${esc(profile.name)}" autocomplete="off" spellcheck="false"><button class="primary" data-action="setup">PLAY WITH FRIENDS <span>↗</span></button><button class="secondary" data-action="practice">PRACTICE WITH BOTS</button><div class="split-actions"><button class="plain" data-action="join">Join a room</button><button class="plain" data-action="loadout">Loadout</button></div><p class="hint">Create a room. Share the code. Up to 8 eggs.<br>No downloads, accounts, or ads.</p></section><div class="character-caption"><div class="eyebrow">READY TO HATCH</div><strong>${esc(profile.name)}</strong><button class="icon-btn" data-action="customize">Customize egg</button></div><section class="panel loadout-panel"><div class="eyebrow weapon-role">YOUR LOADOUT · ${w.role}</div><img class="loadout-portrait" src="${view.weaponPreview(w.id)}" alt="${w.name} weapon model"><h3>${w.name}</h3><p class="weapon-desc">${w.desc}</p><div class="weapon-list">${WEAPONS.filter(
      (w) => !w.secondary,
    )
      .map(
        (v, i) =>
          `<button class="weapon-key ${v.id === w.id ? "active" : ""}" data-weapon="${v.id}" title="${v.name}" aria-label="Select ${v.name}" aria-pressed="${v.id === w.id}">${i + 1}</button>`,
      )
      .join("")}</div>${[
      ["POWER", Math.min(100, w.damage * w.pellets)],
      ["FIRE RATE", Math.min(100, 9 / w.interval)],
      ["MOBILITY", w.speed * 11],
    ]
      .map(
        ([n, v]) =>
          `<div class="stat">${n}<div class="stat-bar"><span style="width:${v}%"></span></div></div>`,
      )
      .join(
        "",
      )}<button class="plain" data-action="customize">Colors & headwear</button><p class="hint">${stats.matches} matches · ${stats.kills} eliminations</p></section></main><div class="footer"><span>YOLK YARD · ORIGINAL EGG ARENA</span><span class="footer-right">WASD + MOUSE &nbsp; / &nbsp; <button data-action="about">About & credits</button></span></div>`;
  $("#player-name").addEventListener("change", (e) => {
    profile.name = safeProfile({ name: e.target.value }).name;
    e.target.value = profile.name;
    remember();
  });
}
function modal(title, body, type = "generic") {
  dialogType = type;
  keys.clear();
  queuedActions.clear();
  input.fire = false;
  input.aim = false;
  paused = true;
  if (document.pointerLockElement) document.exitPointerLock();
  dialog.innerHTML = `<div class="dialog-head"><h2>${title}</h2><button class="close-btn" data-action="close" aria-label="Close dialog">×</button></div><div class="dialog-body">${body}</div>`;
  if (!dialog.open) dialog.showModal();
}
function closeDialog() {
  dialog.close();
  dialogType = "";
  if (screen === "game") {
    if (state?.phase === "playing") pauseMenu();
    else if (state?.phase === "results") resultsMenu();
  }
}
function toast(text) {
  $("#toast").textContent = text;
  toastUntil = performance.now() + 4500;
}
function notice(text) {
  $("#notice").textContent = text;
  noticeUntil = performance.now() + 2600;
}
function settingsMenu() {
  modal(
    "Make it yours",
    `<p>Settings are saved on this browser.</p>${[
      ["sensitivity", "Mouse sensitivity", 0.2, 3, 0.1],
      ["scopeSensitivity", "Scope sensitivity", 0.1, 2, 0.05],
      ["fov", "Field of view", 65, 110, 1],
      ["volume", "Sound volume", 0, 1, 0.05],
    ]
      .map(
        ([id, label, min, max, step]) =>
          `<div class="setting-row"><label class="setting-label" for="${id}">${label} <output id="out-${id}">${settings[id]}</output></label><input type="range" id="${id}" data-setting="${id}" min="${min}" max="${max}" step="${step}" value="${settings[id]}"></div>`,
      )
      .join(
        "",
      )}<div class="setting-row"><label for="quality" class="setting-label">Graphics</label><select id="quality" data-setting="quality"><option value="high" ${settings.quality === "high" ? "selected" : ""}>High · shadows</option><option value="low" ${settings.quality === "low" ? "selected" : ""}>Low · faster</option></select></div><div class="setting-row"><label for="invert" class="setting-label">Invert vertical look</label><input id="invert" data-setting="invert" type="checkbox" ${settings.invert ? "checked" : ""}></div><h3 style="margin-top:22px">Crosshair</h3>${[["centerDot", "Center Dot"], ["hitMarkers", "Hit Markers"]].map(([id, label]) => `<div class="setting-row"><label for="${id}" class="setting-label">${label}</label><input id="${id}" data-setting="${id}" type="checkbox" ${settings[id] ? "checked" : ""}></div>`).join("")}<button class="primary" data-action="close" style="margin-top:22px">Done</button>`,
    "settings",
  );
}
function loadoutMenu() {
  modal(
    "Choose your blaster",
    `<p>${screen === "game" ? "Your selection takes effect on your next respawn." : "Every blaster includes a Pip sidearm and two poppers."}</p><div class="selection-grid">${WEAPONS.filter(
      (w) => !w.secondary,
    )
      .map(
        (w) =>
          `<button class="weapon-card ${profile.weapon === w.id ? "selected" : ""}" data-weapon="${w.id}" aria-pressed="${profile.weapon === w.id}"><img class="weapon-portrait" src="${view.weaponPreview(w.id)}" alt="${w.name} weapon model"><span class="eyebrow">${w.role}</span><strong>${w.name}</strong><small>${w.desc}</small><small style="margin-top:8px">${w.magazine} shots · ${w.automatic ? "Automatic" : w.burst ? "3-shot burst" : "Semi-auto"} · ${w.reload.toFixed(2)}s reload · ${w.optic === "scope" ? "Precision scope" : w.optic === "prism" ? "Prism optic" : w.optic === "reflex" ? "Reflex sight" : "Open sights"}</small></button>`,
      )
      .join(
        "",
      )}</div><button class="primary" data-action="close">Done</button>`,
    "loadout",
  );
}
function customizeMenu() {
  modal(
    "Your egg. Your style.",
    `<p>All colors and headwear are unlocked.</p><h3 style="margin-top:23px;font-size:1rem">Shell color</h3><div class="swatches">${COLORS.map((c, i) => `<button class="swatch ${c === profile.color ? "active" : ""}" style="background:${c}" data-color="${c}" aria-label="Shell color ${i + 1}" aria-pressed="${c === profile.color}"></button>`).join("")}</div><h3 style="font-size:1rem">Headwear</h3><div class="hats">${HATS.map((h, i) => `<button class="hat ${i === profile.hat ? "active" : ""}" data-hat="${i}">${h}</button>`).join("")}</div><button class="primary" data-action="close">Looking good</button>`,
    "customize",
  );
}
function helpMenu() {
  modal(
    "How to play",
    `<p>Move, aim, and tag the other eggs. You return after 3 seconds when your shell runs out. Health recovers after 6 seconds without a hit.</p><table class="controls-table">${[
      ["W A S D / Arrow keys", "Move"],
      ["Mouse", "Look"],
      ["Left click", "Fire"],
      ["Right click / Shift", "Aim"],
      ["Space", "Jump"],
      ["R", "Reload"],
      ["E / G", "Throw a popper"],
      ["1 / 2 / Q", "Primary / sidearm"],
      ["Tab", "Scoreboard"],
      ["Escape", "Menu"],
    ]
      .map(([a, b]) => `<tr><td><kbd>${a}</kbd></td><td>${b}</td></tr>`)
      .join(
        "",
      )}</table><p>Collect white crosses for health, gold boxes for ammo, and purple eggs for poppers. Blue and coral are teammates in team modes; friendly fire is off.</p><p class="hint">Mac: click inside the arena to capture your mouse. Escape releases it. Touch devices use a left joystick, drag-to-look area, and action buttons.</p>`,
    "help",
  );
}
function setupMenu(practice = false) {
  if (!practice) options.bots = 0;
  modal(
    practice ? "Practice arena" : "Create a private room",
    `<p>${practice ? "Warm up with bots. Practice needs no multiplayer connection." : "Share the room code with your friends. Keep your tab open and in front while hosting."}</p><div class="form-grid"><label>ARENA<select class="field" id="setup-map">${MAPS.map((m) => `<option value="${m.id}" ${m.id === options.map ? "selected" : ""}>${m.name}</option>`).join("")}</select></label><label>MODE<select class="field" id="setup-mode">${MODES.map((m) => `<option value="${m.id}" ${m.id === options.mode ? "selected" : ""}>${m.name}</option>`).join("")}</select></label><label>BOTS<select class="field" id="setup-bots">${[0, 1, 2, 3, 4, 5, 6, 7].map((n) => `<option ${n === options.bots ? "selected" : ""}>${n}</option>`).join("")}</select></label><label>BOT DIFFICULTY<select class="field" id="setup-difficulty">${["Relaxed", "Regular", "Sharp"].map((n, i) => `<option value="${i + 1}" ${i + 1 === options.difficulty ? "selected" : ""}>${n}</option>`).join("")}</select></label></div><p class="small" id="mode-desc">${mode(options.mode).description}</p><p class="hint">${practice ? "5-minute rounds. Choose zero bots to explore the arena." : "Friends replace bots when the room is full. The host decides when to start."}</p><button class="primary" style="margin-top:22px" data-action="${practice ? "start-practice" : "create-room"}">${practice ? "START PRACTICE" : "CREATE ROOM"}</button>`,
    "setup",
  );
  $("#setup-mode").onchange = (e) =>
    ($("#mode-desc").textContent = mode(e.target.value).description);
}
function getOptions() {
  options = {
    map: $("#setup-map").value,
    mode: $("#setup-mode").value,
    bots: Number($("#setup-bots").value),
    difficulty: Number($("#setup-difficulty").value),
  };
  return options;
}
function joinMenu(code = "") {
  modal(
    "Join your friends",
    `<p>Ask the host for the 8-character room code.</p><label class="setting-label" for="join-code" style="margin:22px 0 8px">ROOM CODE</label><input class="field" id="join-code" placeholder="ABCD-EFGH" value="${esc(code)}" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" style="font-size:1.6rem;letter-spacing:.16em;text-align:center;text-transform:uppercase"><button class="primary" style="margin-top:20px" data-action="join-room">JOIN ROOM</button><p class="hint">Room connections depend on your network allowing multiplayer. Practice always works once the game has loaded.</p>`,
    "join",
  );
  $("#join-code").onkeydown = (e) => {
    if (e.key === "Enter") joinRoom();
  };
}
function callbacks() {
  return {
    onJoin: (id, p) => {
      if (!sim) return false;
      if (sim.players.size >= 8) {
        const bot = [...sim.players.values()].find((p) => p.bot);
        if (bot) sim.removePlayer(bot.id);
        else return false;
      }
      return !!sim.addPlayer(id, p);
    },
    onLeave: (id) => sim?.removePlayer(id),
    onPlayerAction: (id, action) => sim?.playerAction(id, action),
    onInput: (id, i) => sim?.setInput(id, i),
    onProfile: (id, p) => sim?.setProfile(id, p),
    onState: (s) => {
      state = s;
      const me = s.players.find((p) => p.id === localId);
      if (!me) return;
      pendingInputs = pendingInputs.filter((i) => i.seq > me.ack);
      predicted = { ...me, ammo: [...me.ammo], reserve: [...me.reserve] };
      for (const i of pendingInputs)
        movePlayer(predicted, i, getMap(s.options.map), 1 / 60);
      if (me.health > 0 && lastHealth <= 0) {
        input.yaw = me.yaw;
        input.pitch = me.pitch;
        input.slot = 0;
        pendingInputs = [];
      }
      lastHealth = me.health;
      handleState();
    },
    onError: (message) => {
      leave(false);
      modal(
        "Connection ended",
        `<div class="error-box">${esc(message)}</div><button class="primary" data-action="close">Back to arena</button>`,
        "error",
      );
    },
    onStatus: (message) => {
      if (message.includes("disconnected")) toast(message);
    },
  };
}
function beginSim() {
  sim = new Simulation(options);
  sim.addPlayer("host", profile);
  localId = "host";
  lastEvent = 0;
  roundSaved = -1;
  lastPhase = "";
  state = sim.snapshot();
  pendingInputs = [];
  seq = 0;
  predicted = null;
}
async function createRoom() {
  if (busy) return;
  getOptions();
  beginSim();
  busy = true;
  modal(
    "Opening your room",
    `<div class="spinner"></div><p>Connecting to the room service…</p><button class="plain" data-action="cancel-connect" style="margin-top:18px">Cancel</button>`,
    "connecting",
  );
  const attempt = new Network(callbacks());
  net = attempt;
  try {
    await attempt.host();
    if (attempt !== net) return;
    screen = "lobby";
    paused = true;
    dialog.close();
    dialogType = "";
    $("#menu").hidden = true;
    $("#lobby").hidden = false;
    renderLobby();
  } catch (e) {
    if (attempt !== net) return;
    attempt.destroy();
    net = null;
    sim = null;
    state = null;
    modal(
      "Room could not open",
      `<div class="error-box">${esc(e.message)}</div><button class="primary" data-action="practice">Play practice</button><button class="plain" data-action="setup" style="margin-top:12px">Try creating a room again</button>`,
      "error",
    );
  } finally {
    busy = false;
  }
}
async function joinRoom() {
  if (busy) return;
  const code = cleanCode($("#join-code")?.value);
  if (code.length !== 8) {
    toast("Enter all 8 characters of the room code.");
    return;
  }
  busy = true;
  modal(
    "Joining the room",
    `<div class="spinner"></div><p>Looking for ${formatCode(code)}…</p><button class="plain" data-action="cancel-connect" style="margin-top:18px">Cancel</button>`,
    "connecting",
  );
  const attempt = new Network(callbacks());
  net = attempt;
  sim = null;
  state = null;
  lastEvent = 0;
  lastPhase = "";
  roundSaved = -1;
  seq = 0;
  pendingInputs = [];
  try {
    localId = await attempt.join(code, profile);
    if (attempt !== net) return;
    screen = "lobby";
    paused = true;
    dialog.close();
    dialogType = "";
    $("#menu").hidden = true;
    $("#lobby").hidden = false;
    renderLobby();
  } catch (e) {
    if (attempt !== net) return;
    attempt.destroy();
    net = null;
    modal(
      "Could not join",
      `<div class="error-box">${esc(e.message)}</div><button class="primary" data-action="join">Check the code & retry</button><button class="plain" data-action="practice" style="margin-top:12px">Practice instead</button>`,
      "error",
    );
  } finally {
    busy = false;
  }
}
function renderLobby() {
  if (screen !== "lobby") return;
  const roster = state?.players || [],
    o = state?.options || options;
  $("#lobby").innerHTML =
    `${titleBar()}<section class="panel lobby-panel"><div class="eyebrow">PRIVATE ROOM</div><h2 style="margin-top:8px">The gang’s all here.</h2><div class="room-code">${formatCode(net?.code || "--------")}</div><div class="split-actions"><button class="plain" data-action="copy-code">Copy code</button><button class="plain" data-action="copy-link">Copy invite link</button></div><div class="lobby-meta"><strong>${getMap(o.map).name}</strong><span>·</span><span>${mode(o.mode).name}</span></div><div class="roster">${roster.map((p) => `<div class="roster-row"><b><span class="team-dot ${p.team === 1 ? "coral" : ""}"></span>${esc(p.name)}${p.id === localId ? " (you)" : ""}</b><span>${p.bot ? "BOT" : weapon(p.weapon).name}</span>${net?.isHost && p.id !== localId && !p.bot ? `<button data-kick="${esc(p.id)}">Remove</button>` : ""}</div>`).join("")}</div><p class="hint" style="margin-bottom:18px">${net?.isHost ? `${o.bots} bots will fill available spots. Keep this tab in front while hosting.` : "Waiting for the host to start. You can choose your loadout while you wait."}</p><div class="room-bottom">${net?.isHost ? '<button class="primary" data-action="start-match">START MATCH</button>' : '<button class="primary" data-action="loadout">Choose loadout</button>'}<button class="plain" data-action="leave">Leave</button></div></section>`;
}
function startPractice() {
  getOptions();
  beginSim();
  sim.startRound();
  state = sim.snapshot();
  enterGame(true);
}
function enterGame(capture = false) {
  screen = "game";
  $("#menu").hidden = true;
  $("#lobby").hidden = true;
  document.body.classList.add("in-game");
  lastPhase = "playing";
  const p = state.players.find((p) => p.id === localId);
  if (p) {
    input.yaw = p.yaw;
    input.pitch = p.pitch;
    input.slot = p.slot;
    lastHealth = p.health;
    predicted = null;
  }
  dialog.close();
  dialogType = "";
  // Join the match as an inactive egg; only the entry button requests a spawn.
  resume(false);

}
async function resume(capture = true) {
  dialog.close();
  dialogType = "";
  paused = false;
  keys.clear();
  queuedActions.clear();
  sound.unlock();
  if (capture && !state?.players.find(p => p.id === localId)?.spectating && !matchMedia("(pointer:coarse)").matches) {
    try {
      const result = $("#world").requestPointerLock();
      if (result?.catch) await result;
    } catch {
      pauseMenu();
      toast("Mouse lock was unavailable. Press Resume to try again.");
    }
  }
}
let spectateTarget = null;
let spawnIntentUntil = 0;
function switchSpectator(step) {
  const players = state?.players.filter(p => p.id !== localId && !p.spectating && p.health > 0) || [];
  const index = players.findIndex(p => p.id === spectateTarget);
  spectateTarget = players.length ? players[(index + step + players.length) % players.length].id : null;
}
function playerAction(action) {
  spawnIntentUntil = action === "spectate" ? 0 : performance.now() + 5000;
  if (sim) { sim.playerAction(localId, action); state = sim.snapshot(); }
  else net?.send({type: "player-action", action});
  pendingInputs = [];
  predicted = null;
  resume(action !== "spectate");
}
function pauseMenu() {
  if (screen !== "game") return;
  modal(
    "Take a breather",
    `<p>${net ? "The multiplayer match keeps running while this menu is open." : "Practice is paused."}</p><button class="primary" data-action="resume" style="margin-top:22px">RESUME</button><div class="split-actions"><button class="plain" data-action="respawn-player">Respawn</button><button class="plain" data-action="spectate">Spectate</button></div><div class="split-actions"><button class="plain" data-action="loadout">Loadout</button><button class="plain" data-action="settings">Settings</button></div>${net ? '<button class="plain" data-action="copy-link" style="margin-top:12px">Copy invite link</button>' : ""}<button class="secondary" data-action="leave-confirm" style="margin-top:12px">${net?.isHost ? "Close room" : "Leave match"}</button>`,
    "pause",
  );
}
function leave(confirm = false) {
  if (confirm && net?.isHost) {
    modal(
      "Close this room?",
      `<p>This ends the match for everyone in the room.</p><div class="split-actions"><button class="plain" data-action="pause">Keep playing</button><button class="primary" data-action="leave">Close room</button></div>`,
      "leave",
    );
    return;
  }
  net?.destroy();
  net = null;
  sim = null;
  state = null;
  predicted = null;
  screen = "menu";
  paused = true;
  busy = false;
  keys.clear();
  queuedActions.clear();
  pendingInputs = [];
  input.fire = false;
  input.aim = false;
  $("#lobby").hidden = true;
  $("#menu").hidden = false;
  document.body.classList.remove("in-game");
  if (document.pointerLockElement) document.exitPointerLock();
  dialog.close();
  dialogType = "";
  $("#feed").innerHTML = "";
  renderMenu();
  updates.apply();
  void updates.check();
}
function scoresHTML(s = state) {
  return `<table class="scores"><thead><tr><th>Egg</th><th>Elims</th><th>Downs</th><th>Score</th></tr></thead><tbody>${[
    ...(s?.players || []),
  ]
    .sort((a, b) => b.points - a.points || b.kills - a.kills)
    .map(
      (p) =>
        `<tr class="${p.id === localId ? "local" : ""}"><td>${mode(s.options.mode).teams ? `<span class="team-dot ${p.team === 1 ? "coral" : ""}"></span>` : ""}${esc(p.name)}${p.bot ? " · BOT" : ""}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${Math.floor(p.points)}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}
function resultsMenu() {
  const p = state.players.find((p) => p.id === localId);
  if (roundSaved !== state.round && p) {
    roundSaved = state.round;
    stats.matches++;
    stats.kills += p.kills;
    if (
      mode(state.options.mode).teams
        ? state.scores[p.team] > state.scores[1 - p.team]
        : state.winner === p.name + " wins"
    )
      stats.wins++;
    save("yolk-stats", stats);
  }
  modal(
    "That’s a wrap.",
    `<div class="results"><div class="eyebrow">ROUND ${state.round} COMPLETE</div><h2 style="margin:12px 0">${esc(state.winner)}</h2>${scoresHTML()}${sim ? '<button class="primary" data-action="rematch">PLAY AGAIN</button>' : "<p>Waiting for the host to start another round.</p>"}<div class="split-actions"><button class="plain" data-action="loadout">Change loadout</button><button class="plain" data-action="leave-confirm">Leave match</button></div></div>`,
    "results",
  );
}
function handleState() {
  if (!state) return;
  if (state.phase === "playing" && lastPhase !== "playing") {
    lastPhase = "playing";
    enterGame(false);
  }
  if (state.phase === "results" && lastPhase !== "results") {
    lastPhase = "results";
    resultsMenu();
  }
  if (screen === "lobby") renderLobby();
}
function processEvents() {
  if (!state) return;
  for (const e of state.events) {
    if (e.id <= lastEvent) continue;
    lastEvent = e.id;
    if (state.time - e.time > 1.6) continue;
    view.event(e, localId);
    const me = state.players.find((p) => p.id === localId);
    if (e.type === "shot") {
      const distance = me
        ? Math.hypot(e.origin.x - me.x, e.origin.z - me.z)
        : 0;
      sound.shot(e.weapon, distance);
    }
    if (e.type === "launch") sound.shot("scatter");
    if (e.type === "explosion")
      sound.pop(me ? Math.hypot(me.x - e.x, me.z - e.z) : 0);
    if (e.type === "hit") {
      if (e.player === localId) {
        sound.hit();
        hitUntil = performance.now() + 150;
      }
      if (e.target === localId) damageFlash = 0.65;
    }
    if (e.type === "reload" && e.player === localId) sound.reload();
    if (e.type === "pickup" && e.player === localId) {
      sound.pickup();
      notice(
        e.kind === "ammo"
          ? "Ammo restocked"
          : e.kind === "health"
            ? "Shell repaired"
            : "Popper collected",
      );
    }
    if (e.type === "notice") notice(e.text);
    if (e.type === "elimination") {
      sound.death(me ? Math.hypot(me.x-e.x, me.z-e.z) : 0);
      const row = document.createElement("div");
      row.className = "kill-line" + (e.player === localId ? " me" : "");
      row.innerHTML = `${esc(e.name)} <span>${esc(e.weapon)}</span> ${esc(e.targetName)}`;
      row.dataset.expire = String(performance.now() + 5500);
      $("#feed").prepend(row);
      while ($("#feed").children.length > 4) $("#feed").lastChild.remove();
      if (e.player === localId && e.target !== localId) {
        sound.eliminate();
        notice(
          e.streak >= 3 ? `${e.streak} in a row!` : `Tagged ${e.targetName}`,
        );
      }
      if (e.target === localId)
        $("#respawn-by").textContent = `Tagged by ${e.name} · ${e.weapon}`;
    }
    if (e.type === "player-action" && e.player === localId) {
      $("#respawn-by").textContent = e.action === "respawn" ? "Returning to a fresh spawn" : "";
    }
    if (e.type === "spawn" && e.player === localId) {
      input.slot = 0;
      const p = state.players.find((p) => p.id === localId);
      if (p) {
        if (p.health > 0 && performance.now() < spawnIntentUntil && !dialog.open) void resume();
        spawnIntentUntil = 0;
        input.yaw = p.yaw;
        input.pitch = 0;
      }
      pendingInputs = [];
      predicted = null;
    }
  }
}
function hud() {
  if (screen !== "game" || !state) return;
  const p = state.players.find((p) => p.id === localId);
  if (!p) return;
  const m = mode(state.options.mode);
  $("#hud-mode").textContent = m.name.toUpperCase();
  $("#hud-map").textContent = getMap(state.options.map).name;
  $("#hud-network").textContent = net
    ? (net.isHost ? "HOST · " : net.latency + " ms · ") + formatCode(net.code)
    : "PRACTICE";
  $("#timer").textContent =
    Math.floor(Math.ceil(state.remaining) / 60) +
    ":" +
    String(Math.ceil(state.remaining) % 60).padStart(2, "0");
  $("#score-blue").textContent = m.teams ? state.scores[0] : "";
  $("#score-coral").textContent = m.teams ? state.scores[1] : "";
  $("#objective").textContent =
    m.id === "control"
      ? state.zone.contested
        ? "ZONE CONTESTED"
        : "HOLD THE GOLDEN ZONE"
      : `FIRST TO ${m.limit} ${m.id === "capture" ? "CAPTURES" : "ELIMINATIONS"}`;
  $("#health").textContent = Math.ceil(p.health);
  $("#health-fill").style.width = p.health + "%";
  $("#health-fill").style.background = p.health < 30 ? "#f99b74" : "#8bdcc5";
  $("#streak").textContent =
    state.time < p.shieldUntil
      ? "Spawn shield · firing ends it"
      : p.crown !== null
        ? "You have the crown!"
        : p.streak > 1
          ? p.streak + " elimination streak"
          : "Freshly hatched";
  $("#gun-name").textContent = gun(p).name;
  $("#ammo").textContent = p.ammo[p.slot];
  $("#reserve").textContent = p.reserve[p.slot];
  $("#ammo-extra").textContent =
    p.reloadEnd > state.time
      ? "RELOADING…"
      : `${p.poppers} poppers · ${p.slot === 0 ? "2 → sidearm" : "1 → primary"}`;
  $("#respawn").style.display =
    p.health <= 0 && !p.spectating && state.phase === "playing" ? "block" : "none";
  const killer = p.health <= 0 && state.players.find(k => k.id === p.killerId);
  $("#spectator-stats").textContent = killer
    ? `${killer.health > 0 ? "Spectating" : "Eliminated"} ${killer.name} · Shell ${Math.ceil(killer.health)} · ${gun(killer).name} · ${killer.kills} K / ${killer.deaths} D · ${Math.floor(killer.points)} pts`
    : "";
  const watching = !!p.spectating && state.phase === "playing";
  $("#spectate-panel").hidden = !watching;
  $("#hud").classList.toggle("spectating", watching);
  const target = state.players.find(k => k.id === spectateTarget);
  $("#spectate-info").textContent = target && watching
    ? `${target.name} · Shell ${Math.ceil(target.health)} · ${gun(target).name} · ${target.kills} K / ${target.deaths} D`
    : "Waiting for a player to spawn…";
  const delay = Math.max(0, Math.ceil(p.respawnAt - state.time));
  $("#spawn-heading").textContent = p.awaitingEntry ? "READY TO HATCH" : "SHELL DOWN";
  $("#spawn-status").textContent = p.spawnRequested
    ? (delay ? `Entering in ${delay}…` : "Entering the yard…")
    : delay ? `Respawn available in ${delay}` : "Ready when you are";
  $("#spawn-button").textContent = p.awaitingEntry ? "Enter the Yard" : "Respawn";
  $("#spawn-button").disabled = !!p.spawnRequested || delay > 0;
  if (p.health > 0) spawnIntentUntil = 0;
  if (p.health <= 0 && !p.spawnRequested && performance.now() > spawnIntentUntil && document.pointerLockElement)
    document.exitPointerLock();
  const aiming =
    (input.aim || keys.has("ShiftLeft") || touch.aim) &&
    p.health > 0 &&
    !paused &&
    p.reloadEnd <= state.time;
  $("#crosshair").style.display =
    p.health > 0 && !paused && !aiming ? "block" : "none";
  // Convert the host's current angular shot spread to a screen-space radius.
  const spread = p.shotSpread ?? gun(p).spread;
  const halfAngle = spread * (gun(p).pellets > 1 ? 1 : 0.5);
  const radius = Math.tan(Math.min(halfAngle, 1)) * $("#world").clientHeight * view.camera.projectionMatrix.elements[5] / 2;
  $("#crosshair").style.setProperty("--crosshair-gap", `${clamp(radius, 4, 120)}px`);
  $("#center-dot").hidden = !settings.centerDot;
  $("#hit-marker").hidden = !settings.hitMarkers || p.health <= 0 || paused || performance.now() >= hitUntil;
  const scoped =
    aiming && (gun(p).optic === "scope" || gun(p).optic === "prism");
  $("#scope").style.display = scoped ? "block" : "none";
  $("#scope-label").textContent = scoped
    ? `${gun(p).name.toUpperCase()} / OPTIC ${gun(p).magnification}×`
    : "";
  $("#scoreboard").style.display = scoreHeld && !dialog.open ? "block" : "none";
  if (scoreHeld)
    $("#scoreboard").innerHTML =
      `<h2>${m.name} · ${getMap(state.options.map).name}</h2>${scoresHTML()}`;
}
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied. Send it to your friends.");
  } catch {
    modal(
      "Copy your invite",
      `<p>Select and copy the text below.</p><input class="field" readonly value="${esc(text)}" style="margin-top:16px">`,
      "copy",
    );
  }
}
const actions = {
  updates: () => modal("Update history", RELEASES.map(r =>
    `<article class="release-note"><div class="eyebrow">UPDATE ${esc(r.number)}</div><h3>${esc(r.title)}</h3><ul>${r.changes.map(c => `<li>${esc(c)}</li>`).join("")}</ul></article>`).join("")),
  "enter-yard": () => playerAction(state?.players.find(p => p.id === localId)?.awaitingEntry ? "rejoin" : "respawn"),
  setup: () => setupMenu(false),
  practice: () => setupMenu(true),
  "start-practice": startPractice,
  "create-room": createRoom,
  "join-room": joinRoom,
  join: () => joinMenu(),
  loadout: loadoutMenu,
  customize: customizeMenu,
  settings: settingsMenu,
  help: helpMenu,
  close: closeDialog,
  pause: pauseMenu,
  resume: () => resume(),
  "respawn-player": () => playerAction(state?.players.find(p => p.id === localId)?.spectating ? "rejoin" : "respawn"),
  spectate: () => playerAction("spectate"),
  rejoin: () => playerAction("rejoin"),
  "spectate-prev": () => switchSpectator(-1),
  "spectate-next": () => switchSpectator(1),
  leave: () => leave(),
  "leave-confirm": () => leave(true),
  scores: () => {
    scoreHeld = !scoreHeld;
  },
  "cancel-connect": () => leave(),
  "start-match": () => {
    sim.startRound();
    state = sim.snapshot();
    net.broadcast(state);
    enterGame(true);
  },
  rematch: () => {
    sim.startRound();
    state = sim.snapshot();
    net?.broadcast(state);
    enterGame(true);
  },
  "copy-code": () => copy(formatCode(net.code)),
  "copy-link": () => {
    const u = new URL(location.href);
    u.search = "";
    u.hash = "";
    u.searchParams.set("room", net.code);
    copy(u.href);
  },
  about: () =>
    modal(
      "Made for a good scramble",
      `<p>Yolk Yard is an original, independent egg arena shooter. Its maps, characters, blasters, UI, and sounds were created for this game.</p><p style="margin-top:14px">3D rendering: Three.js (MIT). Multiplayer connections: PeerJS (MIT). This game is not affiliated with Shell Shockers or Blue Wizard Digital.</p><p style="margin-top:14px">Your name, loadout, settings, and match totals stay in this browser. Private rooms send your chosen name and game actions to the host. No accounts, chat, purchases, tracking, camera, or microphone.</p><p class="hint">Version 2.0 · All gameplay code is included in the project.</p>`,
      "about",
    ),
};
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.action) {
    sound.unlock();
    actions[b.dataset.action]?.();
  }
  if (b.dataset.weapon) {
    profile.weapon = b.dataset.weapon;
    remember();
    if (dialogType === "loadout") loadoutMenu();
    renderMenu();
  }
  if (b.dataset.color) {
    profile.color = b.dataset.color;
    remember();
    customizeMenu();
  }
  if (b.dataset.hat) {
    profile.hat = Number(b.dataset.hat);
    remember();
    customizeMenu();
  }
  if (b.dataset.kick) net?.kick(b.dataset.kick);
});
document.addEventListener("input", (e) => {
  const name = e.target.dataset.setting;
  if (!name) return;
  settings[name] =
    e.target.type === "checkbox"
      ? e.target.checked
      : e.target.type === "range"
        ? Number(e.target.value)
        : e.target.value;
  const out = $("#out-" + name);
  if (out) out.textContent = settings[name];
  save("yolk-settings", settings);
  sound.volume = settings.volume;
  view.setQuality();
});
dialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  if (dialogType === "connecting") {
    leave();
    return;
  }
  if (dialogType === "results") return;
  if (dialogType === "pause" || dialogType === "ready") resume();
  else closeDialog();
});
document.addEventListener("pointerlockchange", () => {
  if (
    !document.pointerLockElement &&
    screen === "game" &&
    !paused &&
    state?.players.find(p => p.id === localId)?.health > 0 &&
    !matchMedia("(pointer:coarse)").matches
  )
    pauseMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.target.matches("input,select,textarea")) return;
  if (screen !== "game") return;
  if (
    [
      "Tab",
      "Space",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ].includes(e.code)
  )
    e.preventDefault();
  keys.add(e.code);
  if (e.code === "Tab") scoreHeld = true;
  if (!e.repeat) {
    if (!paused) {
      const pulseKey = {
        Space: "jump",
        KeyR: "reload",
        KeyE: "popper",
        KeyG: "popper",
      }[e.code];
      if (pulseKey) queuedActions.add(pulseKey);
    }
    if (e.code === "Digit1") input.slot = 0;
    if (e.code === "Digit2") input.slot = 1;
    if (e.code === "KeyQ") input.slot = 1 - input.slot;
    if (e.code === "Escape" && !dialog.open) {
      e.preventDefault();
      pauseMenu();
    }
  }
});
document.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if (e.code === "Tab") scoreHeld = false;
});
window.addEventListener("blur", () => {
  keys.clear();
  queuedActions.clear();
  input.fire = false;
  input.aim = false;
  touch.fire = false;
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    keys.clear();
    queuedActions.clear();
    input.fire = false;
    if (screen === "game" && !net && !paused) pauseMenu();
  }
});
$("#world").addEventListener("mousedown", (e) => {
  if (screen !== "game" || paused) return;
  if (e.button === 0) {
    input.fire = true;
    queuedActions.add("fire");
  }
  if (e.button === 2) {
    input.aim = true;
  }
});
document.addEventListener("mouseup", (e) => {
  if (e.button === 0) input.fire = false;
  if (e.button === 2) {
    input.aim = false;
  }
});
function aimSensitivity() {
  const aiming = input.aim || keys.has("ShiftLeft") || touch.aim;
  return aiming ? settings.scopeSensitivity : 1;
}
document.addEventListener("mousemove", (e) => {
  if (
    screen !== "game" ||
    paused ||
    !document.pointerLockElement
  )
    return;
  input.yaw -=
    e.movementX * 0.002 * settings.sensitivity * aimSensitivity();
  input.pitch = clamp(
    input.pitch -
      e.movementY *
        0.002 *
        settings.sensitivity *
        (settings.invert ? -1 : 1) *
        aimSensitivity(),
    -1.48,
    1.48,
  );
});
document.addEventListener("contextmenu", (e) => {
  if (screen === "game") e.preventDefault();
});
const stick = $("#touch-stick");
stick.addEventListener("pointerdown", (e) => {
  stick.setPointerCapture(e.pointerId);
  updateStick(e);
});
stick.addEventListener("pointermove", (e) => {
  if (stick.hasPointerCapture(e.pointerId)) updateStick(e);
});
function updateStick(e) {
  const r = stick.getBoundingClientRect();
  touch.x = clamp((e.clientX - r.left - r.width / 2) / 40, -1, 1);
  touch.y = clamp((r.top + r.height / 2 - e.clientY) / 40, -1, 1);
  stick.firstChild.style.transform = `translate(${touch.x * 32}px,${-touch.y * 32}px)`;
}
for (const type of ["pointerup", "pointercancel"])
  stick.addEventListener(type, () => {
    touch.x = touch.y = 0;
    stick.firstChild.style.transform = "";
  });
let lookPosition = null;
const look = $("#touch-look");
look.addEventListener("pointerdown", (e) => {
  look.setPointerCapture(e.pointerId);
  lookPosition = { x: e.clientX, y: e.clientY };
});
look.addEventListener("pointermove", (e) => {
  if (!lookPosition) return;
  input.yaw -= (e.clientX - lookPosition.x) * 0.006 * settings.sensitivity * aimSensitivity();
  input.pitch = clamp(
    input.pitch - (e.clientY - lookPosition.y) * 0.006 * settings.sensitivity * aimSensitivity(),
    -1.48,
    1.48,
  );
  lookPosition = { x: e.clientX, y: e.clientY };
});
for (const t of ["pointerup", "pointercancel"])
  look.addEventListener(t, () => (lookPosition = null));
for (const button of document.querySelectorAll("[data-touch]")) {
  button.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    touch[button.dataset.touch] = true;
    if (!paused && !dialog.open) queuedActions.add(button.dataset.touch);
  });
  for (const t of ["pointerup", "pointercancel"])
    button.addEventListener(t, () => (touch[button.dataset.touch] = false));
}
document.addEventListener("graphics-lost", () => {
  paused = true;
  modal(
    "Graphics paused",
    `<p>The browser lost its graphics connection. Reload this page to restore the arena. Try Low graphics in Settings if it happens again.</p>`,
    "error",
  );
});
function frameInput() {
  const active = screen === "game" && !paused && !dialog.open && state?.players.find(p => p.id === localId)?.health > 0;
  const nextInput = {
    seq: ++seq,
    yaw: input.yaw,
    pitch: input.pitch,
    forward: active
      ? Number(keys.has("KeyW") || keys.has("ArrowUp")) -
        Number(keys.has("KeyS") || keys.has("ArrowDown")) +
        touch.y
      : 0,
    strafe: active
      ? Number(keys.has("KeyD") || keys.has("ArrowRight")) -
        Number(keys.has("KeyA") || keys.has("ArrowLeft")) +
        touch.x
      : 0,
    jump:
      active && (keys.has("Space") || touch.jump || queuedActions.has("jump")),
    fire: active && (input.fire || touch.fire || queuedActions.has("fire")),
    aim: active && (input.aim || keys.has("ShiftLeft") || touch.aim),
    reload:
      active &&
      (keys.has("KeyR") || touch.reload || queuedActions.has("reload")),
    popper:
      active &&
      (keys.has("KeyE") ||
        keys.has("KeyG") ||
        touch.popper ||
        queuedActions.has("popper")),
    slot: input.slot,
  };
  queuedActions.clear();
  return nextInput;
}
let lastTime = performance.now(),
  accumulator = 0,
  broadcastClock = 0,
  hudClock = 0,
  lobbyClock = 0;
function loop(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  accumulator += dt;
  broadcastClock += dt;
  hudClock += dt;
  lobbyClock += dt;
  while (accumulator >= 1 / 60) {
    accumulator -= 1 / 60;
    const i = frameInput();
    if (sim) {
      if (!(paused && !net && screen === "game")) {
        sim.setInput(localId, i);
        sim.tick(1 / 60);
      }
    } else if (net?.ready && state?.phase === "playing") {
      net.input(i);
      const me = state.players.find((p) => p.id === localId);
      if (me?.health > 0) {
        if (!predicted) predicted = { ...me };
        movePlayer(predicted, i, getMap(state.options.map), 1 / 60);
        predicted.moving = Math.abs(i.forward) + Math.abs(i.strafe) > 0.1;
        pendingInputs.push(i);
        if (pendingInputs.length > 180) pendingInputs.shift();
      }
    }
  }
  if (sim) {
    state = sim.snapshot();
    if (net?.isHost && broadcastClock >= 0.05) {
      net.broadcast(state);
      broadcastClock = 0;
    }
    if (state.phase === "results" && lastPhase !== "results") {
      lastPhase = "results";
      resultsMenu();
    }
  }
  if (lobbyClock > 0.5 && screen === "lobby") {
    renderLobby();
    lobbyClock = 0;
  }
  processEvents();
  const me = state?.players.find((p) => p.id === localId);
  if (me?.spectating && !state.players.some(p => p.id === spectateTarget && p.health > 0 && !p.spectating))
    switchSpectator(1);
  view.spectateTarget = me?.spectating ? spectateTarget : null;
  let renderPlayer = predicted;
  if (sim && me) {
    renderPlayer = {
      ...me,
      yaw: input.yaw,
      pitch: input.pitch,
      moving: keys.size > 0,
    };
  } else if (renderPlayer) {
    renderPlayer.yaw = input.yaw;
    renderPlayer.pitch = input.pitch;
  }
  view.update(
    state,
    me,
    renderPlayer,
    dt,
    screen === "game",
    !paused && (input.aim || keys.has("ShiftLeft") || touch.aim),
    profile,
  );
  if (hudClock > 0.06) {
    hud();
    hudClock = 0;
  }
  damageFlash = Math.max(0, damageFlash - dt * 2);
  $("#damage").style.opacity = damageFlash;
  $("#notice").style.opacity = now < noticeUntil ? 1 : 0;
  $("#toast").style.opacity = now < toastUntil ? 1 : 0;
  for (const row of $("#feed").children)
    if (Number(row.dataset.expire) < now) row.remove();
  requestAnimationFrame(loop);
}
try {
  view = new View($("#world"), settings);
  renderMenu();
  requestAnimationFrame(loop);
  const invite = new URL(location.href).searchParams.get("room");
  if (invite) joinMenu(formatCode(cleanCode(invite)));
} catch (e) {
  console.error(e);
  $("#menu").innerHTML =
    `<section class="panel lobby-panel"><h2>3D graphics unavailable</h2><p style="margin-top:15px">This game needs WebGL 2. Try a current Chrome or Safari with graphics acceleration enabled.</p><p class="hint">${esc(e.message)}</p></section>`;
}
// Development-only diagnostics. Vite removes this branch from the published bundle.
if (import.meta.env.DEV && new URL(location.href).searchParams.has("qa"))
  window.__yolkTest = {
    checkUpdate: () => updates.check(),
    read: () => ({
      state,
      localId,
      screen,
      paused,
      predicted,
      input: { ...input },
      camera: view?.camera.rotation.toArray(),
      drawCalls: view?.renderer.info.render.calls,
      scope: {
        active: view?.scopeActive,
        aimBlend: view?.aimBlend,
        lens: !!view?.opticLens,
      },
      triangles: view?.renderer.info.render.triangles,
      presentation: view?.diagnostics(),
    }),
    network: () =>
      Object.values(net?.peer?.connections || {})
        .flat()
        .map((c) => ({
          open: c.open,
          ice: c.peerConnection?.iceConnectionState,
          gathering: c.peerConnection?.iceGatheringState,
          signaling: c.peerConnection?.signalingState,
          localCandidates: (
            c.peerConnection?.localDescription?.sdp?.match(/a=candidate:/g) ||
            []
          ).length,
          remoteCandidates: (
            c.peerConnection?.remoteDescription?.sdp?.match(/a=candidate:/g) ||
            []
          ).length,
        })),
    finish: () => sim?.finish(),
    fixture: (fn) => fn(sim),
    pose: (pose) => {
      const p = sim?.players.get(localId);
      if (!p) return;
      Object.assign(p, pose);
      input.yaw = pose.yaw ?? p.yaw;
      input.pitch = pose.pitch ?? p.pitch;
      input.slot = pose.slot ?? p.slot;
      predicted = null;
    },
    setTime: (t) => {
      if (sim) sim.remaining = t;
    },
  };


// Each deployment emits its build identifier next to index.html.
const updates = new UpdateWatcher({
  build: __BUILD_ID__,
  isInMatch: () => screen === "game" || state?.phase === "playing",
  fetchVersion: async () => {
    const url = new URL("version.json", location.href);
    url.searchParams.set("t", Date.now());
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Version check unavailable");
    return response.json();
  },
  refresh: (build) => {
    // Preserve saved settings; a unique document URL bypasses an old cached index.
    net?.destroy();
    const url = new URL(location.href);
    url.searchParams.set("build", build);
    url.searchParams.set("refresh", Date.now());
    location.replace(url.href);
  },
});
setInterval(() => void updates.check(), 20000);
window.addEventListener("focus", () => void updates.check());
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void updates.check();
});
void updates.check();
