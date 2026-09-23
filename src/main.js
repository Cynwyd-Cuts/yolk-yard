import {RoyaleSimulation} from './royale.js';
import {RoyaleUI} from './royale-ui.js';
import {SLIDERS, SLIDER_DEFAULTS, resetSliders, royalePanelAction} from './settings.js';
import {queueCandidates,ITEMS,itemInfo} from './royale-data.js';
import { ChatPanel } from "./chat-ui.js";
import { moderateText, safeName } from "./moderation.js";
import {matchOptions, targetLabel} from "./match-options.js";
import "./style.css";
import { CONTROLS, normalizeBindings, validBinding, bindingDown, bindingLabel } from "./keybinds.js";
import { RELEASES, RELEASE } from "./releases.js";
import { UpdateWatcher } from "./updates.js";
import {
  WEAPONS, BOT_DIFFICULTIES, nameKey,
  MODES,
  COLORS,
  HATS, PATTERNS, FINISHES, EYEWEAR, NO_EYEWEAR,
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
import { directory } from "./directory.js";
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
  read("yolk-profile", { name: "Player", weapon: "sprinter", hat: 0, eyewear: NO_EYEWEAR }),
);
const settings = {
  ...SLIDER_DEFAULTS,
  quality: "high",
  invert: false,
  centerDot: true,
  hitMarkers: true,
  chatMode: "all",
  ...read("yolk-settings", {}),
};
// Migrate the former alternate aim key to dedicated sprint exactly once.
if(!settings.royaleBindings){if(settings.keybinds?.aim)settings.keybinds.aim=settings.keybinds.aim.map(k=>k==='ShiftLeft'?null:k);settings.royaleBindings=true;}
settings.keybinds = normalizeBindings(settings.keybinds);
settings.chatMode = ["all", "quick", "off"].includes(settings.chatMode) ? settings.chatMode : "all";
save("yolk-profile", profile);
delete settings.dragLook;
save("yolk-settings", settings);
settings.sensitivity = clamp(Number(settings.sensitivity) || 1, 0.2, 3);
settings.scopeSensitivity = clamp(Number(settings.scopeSensitivity) || 0.65, 0.1, 2);
settings.fov = clamp(Number(settings.fov) || 85, 65, 110);
settings.volume = clamp(Number(settings.volume) || 0, 0, 1);
let stats = read("yolk-stats", { matches: 0, kills: 0, wins: 0 }),
  options = matchOptions({map:"yard", mode:"ffa"});
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
sound.setVolumes(settings);
const keys = new Set();
const actionDown = action => bindingDown(settings.keybinds, keys, action);
const controlLabel = action => settings.keybinds[action].filter(Boolean).map(bindingLabel).join(' / ') || 'Unbound';
let bindingCapture = null;
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
  `<div id="menu"></div><div id="lobby" hidden></div><div id="hud"><div class="scope" id="scope"><span id="scope-label"></span></div><div class="hud-top"><div class="match-label"><span id="hud-mode"></span><strong id="hud-map"></strong><span id="hud-network"></span></div><div class="match-center"><div class="score-pair"><b class="blue-score" id="score-blue"></b><b id="timer">5:00</b><b class="coral-score" id="score-coral"></b></div><small id="objective"></small></div><div class="hud-buttons"><button data-action="scores" aria-label="Scoreboard">Scores</button><button data-action="pause" aria-label="Pause menu">Ⅱ</button></div></div><div class="killfeed" id="feed"></div><div class="crosshair" id="crosshair"><i class="crosshair-arm left"></i><i class="crosshair-arm right"></i><i class="crosshair-arm top"></i><i class="crosshair-arm bottom"></i><span class="center-dot" id="center-dot"></span></div><div id="hit-marker" class="hit-marker" hidden></div><div class="hit-flash" id="damage"></div><div id="damage-directions" aria-hidden="true"></div><div id="round-banner" role="status" hidden></div><div class="notice" id="notice"></div><div class="respawn" id="respawn"><div class="eyebrow" id="spawn-heading">SHELL HEALTH DEPLETED</div><h2 id="spawn-status">Ready when you are</h2><button class="primary" id="spawn-button" data-action="enter-yard">Respawn</button><p class="small" id="respawn-by"></p><p class="small" id="spectator-stats"></p><button class="plain" data-action="loadout">Change loadout</button></div><div class="hud-bottom"><div class="health-card"><div class="health-label">SHELL HEALTH <b id="health">100</b></div><div class="health-bar"><span id="health-fill"></span></div><div class="ammo-extra" id="streak">Freshly hatched</div></div><div class="quick-controls"><span><kbd>W A S D</kbd> Move</span><span><kbd>R</kbd> Reload</span><span><kbd>E</kbd> Popper</span><span><kbd>1 / 2</kbd> Swap</span><span><kbd>Esc</kbd> Menu</span></div><div class="ammo-card"><div class="eyebrow" id="gun-name"></div><div class="ammo-count"><b id="ammo">30</b> <span>/ <span id="reserve">150</span></span></div><div class="ammo-extra" id="ammo-extra"></div></div></div><div id="spectate-panel" hidden><div class="eyebrow">SPECTATING</div><p id="spectate-info"></p><div class="split-actions"><button data-action="spectate-prev">← Previous</button><button data-action="spectate-next">Next →</button><button data-action="rejoin">Join game</button></div></div><div class="scoreboard" id="scoreboard"></div><div class="mobile-controls"><div class="touch-stick" id="touch-stick" aria-label="Movement joystick"><span></span></div><div class="touch-look" id="touch-look" aria-label="Drag to look"></div><div class="touch-buttons"><button data-touch="jump">JUMP</button><button data-touch="fire">FIRE</button><button data-touch="reload">LOAD</button><button data-touch="aim">AIM</button><button data-touch="popper">POP</button></div></div></div><dialog id="dialog"></dialog><div class="toast" id="toast" role="status"></div>`;
const dialog = $("#dialog");
const royaleUI = new RoyaleUI(item=>view.itemPreview(item));
let resultAt=0;const damageSources=[];
let matchRequest=0, autoQueue=false, swapSlot=-1;
const chat = new ChatPanel($("#app"), {
  context: () => ({state, localId, preference:settings.chatMode, connected:!!net?.ready && !net.closed && screen!=="menu", host:!!net?.isHost, enabled:net?.chatEnabled, roomMuted:net?.chatMuted||[]}),
  setPreference: value => {settings.chatMode=value;save("yolk-settings",settings);},
  send: payload => net?.chat(payload) || {ok:false,reason:"disconnected"},
  report: (id,reason) => net?.reportChat(id,reason),
  silence: (id,value) => net?.setChatMuted(id,value),
  enable: value => net?.setChatEnabled(value),
  remove: id => net?.kick(id),
  open: () => {
    keys.clear();queuedActions.clear();scoreHeld=false;
    input.fire=false;input.aim=false;
    Object.assign(touch,{x:0,y:0,jump:false,fire:false,aim:false,reload:false,popper:false,sprint:false,interact:false});
    if(document.pointerLockElement)document.exitPointerLock();
  },
  close: (controls) => {
    keys.clear();queuedActions.clear();
    if(controls&&screen==="game"){pauseMenu();return;}
    if(net?.ready && !net.closed && screen==="game" && state?.phase==="playing" && !dialog.open)void resume();
  },
});
function remember() {
  save("yolk-profile", profile);
  if (sim) {if(sim.setProfile(localId, profile)===false)renamePrompt();}
  else net?.profile(profile);
}
function titleBar() {
  return `<div class="topbar"><div class="brand">YOLK<br><span>YARD</span></div><div class="top-actions"><button class="pill" data-action="updates">QUALITY UPDATE · ${RELEASE}</button><button class="icon-btn" data-action="help">How to play</button><button class="icon-btn" data-action="settings" aria-label="Settings">Settings</button></div></div>`;
}
function renderMenu() {
  const w = weapon(profile.weapon);
  $("#menu").innerHTML =
    `<div class="menu-shade"></div>${titleBar()}<main class="menu-layout"><section class="panel play-panel"><div class="eyebrow">GOOD EGGS. GREAT AIM.</div><h1>Time to<br>scramble.</h1><label class="name-label" for="player-name">YOUR NAME</label><input class="field" id="player-name" maxlength="18" value="${esc(profile.name)}" autocomplete="off" spellcheck="false" aria-describedby="name-safety"><p class="name-safety" id="name-safety" role="status">Use a nickname. Keep personal details private.</p><button class="primary royale-home" data-action="royale-home">YOLK ROYALE <span>↗</span><small>DROP IN · LOOT UP · LAST EGG STANDING</small></button><button class="secondary" data-action="setup">CREATE MATCH <span>↗</span></button><button class="secondary" data-action="public-rooms">BROWSE PUBLIC MATCHES</button><div class="split-actions"><button class="plain" data-action="join">Join a room</button><button class="plain" data-action="loadout">Loadout</button></div><p class="hint">Create a room. Share the code. 8 in arenas. 16 in Royale.<br>No accounts or downloads.</p></section><div class="character-caption"><div class="eyebrow">READY TO HATCH</div><strong>${esc(profile.name)}</strong><button class="icon-btn" data-action="customize">Customize egg</button></div><section class="panel loadout-panel"><div class="eyebrow weapon-role">YOUR LOADOUT · ${w.role}</div><img class="loadout-portrait" src="${view.weaponPreview(w.id)}" alt="${w.name} weapon model"><h3>${w.name}</h3><p class="weapon-desc">${w.desc}</p><div class="weapon-list">${WEAPONS.filter(
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
      )}<button class="plain" data-action="customize">Egg studio</button><p class="hint">${stats.matches} matches · ${stats.kills} eliminations</p></section></main><div class="footer"><span>YOLK YARD · ORIGINAL EGG ARENA</span><span class="footer-right">WASD + MOUSE &nbsp; / &nbsp; <button data-action="about">About & credits</button></span></div>`;
  $("#player-name").addEventListener("change", (e) => {
    const checked=moderateText(e.target.value,{kind:"name"});
    profile.name = safeName(e.target.value);
    $("#name-safety").textContent=checked.ok ? "Use a nickname. Keep personal details private." : "That name was filtered. Please choose a friendly nickname.";
    const caption=$(".character-caption strong");if(caption)caption.textContent=profile.name;
    e.target.value = profile.name;
    remember();
  });
}
function modal(title, body, type = "generic") {
  if(type==="error")sound.cue("ui-error");
  bindingCapture = null;
  dialogType = type;
  dialog.dataset.kind=type;
  keys.clear();
  scoreHeld = false;
  queuedActions.clear();
  input.fire = false;
  input.aim = false;
  paused = true;
  if (document.pointerLockElement) document.exitPointerLock();
  dialog.innerHTML = `<div class="dialog-head"><h2>${title}</h2><button class="close-btn" data-action="close" aria-label="Close dialog">×</button></div><div class="dialog-body">${body}</div>`;
  if (!dialog.open) dialog.showModal();
}
function closeDialog() {
  if(dialogType==='rename'){toast('Choose an available name to continue, or leave the match.');return;}
  if(['royale-inventory','royale-map'].includes(dialogType)){void resume();return;}
  sound.cue('ui-back');
  bindingCapture = null;
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
    `<p>Settings are saved on this browser.</p><button class="slider-reset-all" data-reset-slider="all">Reset all sliders</button>${SLIDERS
      .map(
        ([id, label, min, max, step]) =>
          `<div class="setting-row"><label class="setting-label" for="${id}">${label} <output id="out-${id}">${settings[id]}</output></label><div class="slider-controls"><input type="range" id="${id}" data-setting="${id}" min="${min}" max="${max}" step="${step}" value="${settings[id]}"><button class="slider-reset" data-reset-slider="${id}" aria-label="Reset ${label}">Reset</button></div></div>`,
      )
      .join(
        "",
      )}<div class="setting-row"><label for="quality" class="setting-label">Graphics</label><select id="quality" data-setting="quality"><option value="high" ${settings.quality === "high" ? "selected" : ""}>High · shadows</option><option value="low" ${settings.quality === "low" ? "selected" : ""}>Low · faster</option></select></div><div class="setting-row"><label for="invert" class="setting-label">Invert vertical look</label><input id="invert" data-setting="invert" type="checkbox" ${settings.invert ? "checked" : ""}></div><h3 style="margin-top:22px">Crosshair</h3>${[["centerDot", "Center Dot"], ["hitMarkers", "Hit Markers"]].map(([id, label]) => `<div class="setting-row"><label for="${id}" class="setting-label">${label}</label><input id="${id}" data-setting="${id}" type="checkbox" ${settings[id] ? "checked" : ""}></div>`).join("")}<h3>Chat & privacy</h3><div class="setting-row"><label for="chatMode" class="setting-label">Chat messages</label><select id="chatMode" data-setting="chatMode"><option value="all" ${settings.chatMode === "all" ? "selected" : ""}>Filtered messages</option><option value="quick" ${settings.chatMode === "quick" ? "selected" : ""}>Quick messages only</option><option value="off" ${settings.chatMode === "off" ? "selected" : ""}>Off</option></select></div><p class="small">The safety filter stays on in every room. Use Pause → Player controls to mute or report a player.</p><h3>Keybinds</h3><p class="small" id="binding-help" role="status">Choose a binding, then press a key or mouse button. Esc cancels; Delete clears. Esc always opens the menu.</p><div class="keybind-list">${CONTROLS.map(([id,label]) => `<div class="keybind-row"><span>${label}</span>${settings.keybinds[id].map((code, slot) => `<button data-bind="${id}" data-bind-slot="${slot}" aria-label="Bind ${label} ${slot ? 'alternate' : 'primary'}">${bindingLabel(code)}</button>`).join('')}</div>`).join('')}</div><button data-reset-bindings style="margin-top:16px">Reset default keybinds</button><button class="primary" data-action="close" style="margin-top:22px">Done</button>`,
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
let customTab = "shell";
function customizeMenu() {
  const choices = (key, items) => `<div class="cosmetic-grid">${items.map((name, i) => ({name, i})).sort((a, b) => key === "eyewear" ? Number(b.i === NO_EYEWEAR) - Number(a.i === NO_EYEWEAR) : a.i - b.i).map(({name, i}) => `<button class="cosmetic-tile ${profile[key] === i ? "active" : ""}" data-cosmetic="${key}" data-value="${i}" aria-label="${name}" title="${name}" aria-pressed="${profile[key] === i}"><img src="${view.eggOptionPortrait(key, i)}" alt="" width="140" height="140"><span class="cosmetic-check" aria-hidden="true">✓</span></button>`).join("")}</div>`;
  const colors = (key) => `<div class="swatches">${COLORS.map((c, i) => `<button class="swatch ${c === profile[key] ? "active" : ""}" style="background:${c}" data-cosmetic="${key}" data-value="${c}" aria-label="${key === "color" ? "Shell" : "Accent"} color ${i + 1}" aria-pressed="${c === profile[key]}"></button>`).join("")}</div>`;
  const sections = {
    shell: () => `<h3>Shell color <small>24 colors</small></h3>${colors("color")}<h3>Finish</h3>${choices("finish", FINISHES)}`,
    pattern: () => `<h3>Shell pattern</h3>${choices("pattern", PATTERNS)}<h3>Pattern & accessory color</h3>${colors("accent")}`,
    headwear: () => `<h3>Headwear <small>20 styles</small></h3>${choices("hat", HATS)}`,
    eyewear: () => `<h3>Eyewear</h3>${choices("eyewear", EYEWEAR)}<h3>Accessory color</h3>${colors("accent")}`,
  };
  modal("Egg studio", `<div class="egg-studio"><div class="egg-studio-preview"><img src="${view.eggPortrait(profile)}" alt="Your customized egg with matching arms and hands"><div class="eyebrow">YOUR SIGNATURE SHELL</div><strong>${HATS[profile.hat]} · ${PATTERNS[profile.pattern]}</strong><p>Shell color, pattern and finish also apply to your arms and hands. Changes save automatically.</p><button class="secondary" data-action="shuffle-egg">Shuffle look</button><button class="plain" data-action="reset-egg">Reset appearance</button></div><div class="egg-studio-options"><div class="studio-tabs" role="group" aria-label="Customization categories">${[["shell","Shell"],["pattern","Patterns"],["headwear","Headwear"],["eyewear","Eyewear"]].map(([id,label])=>`<button aria-pressed="${id===customTab}" data-custom-tab="${id}" class="${id===customTab ? "active" : ""}">${label}</button>`).join("")}</div><div>${sections[customTab]()}</div><p class="hint">Cosmetic only. Team matches keep your team-colored band.</p><button class="primary" data-action="close">Looking good</button></div></div>`, "customize");
}
function helpMenu() {
  modal(
    "How to play",
    `<p>Move, aim, and tag the other eggs. You return after 3 seconds when your shell health runs out. Health recovers after 6 seconds without a hit.</p><table class="controls-table">${[
      ...CONTROLS.map(([id, label]) => [controlLabel(id), label]),
      ["Mouse", "Look"],
      ["Escape", "Menu"],
    ]
      .map(([a, b]) => `<tr><td><kbd>${a}</kbd></td><td>${b}</td></tr>`)
      .join(
        "",
      )}</table><p>Collect white crosses for health, gold boxes for ammo, and purple eggs for poppers. Blue and coral are teammates in team modes; friendly fire is off.</p><p class="hint">Mac: click inside the arena to capture your mouse. Escape releases it. Touch devices use a left joystick, drag-to-look area, and action buttons.</p>`,
    "help",
  );
}
function ruleSummary(o) {
  if(o.mode==='royale')return `${o.capacity} contestants · ${o.fill?"Fill with bots":o.bots+" bots"} · ${o.storm==='quick'?'Quick':'Normal'} storm · One life`;
  return `${o.minutes} min · ${o.scoreLimit} eliminations to win · ${o.bots} bots · ${BOT_DIFFICULTIES[o.difficulty-1]}`;
}
function setupMenu(editing = false, draft = null) {
  if (editing && (!sim || state?.phase === "playing")) return;
  const o = draft || (editing ? state.options : options);
  const nextRound = editing && state.phase === "results";
  const select = (id,label,items,value) => `<label>${label}<select class="field" id="setup-${id}">${items.map(([key,text])=>`<option value="${key}" ${key === value ? "selected" : ""}>${text}</option>`).join("")}</select></label>`;
  modal(nextRound ? "Set up the next round" : editing ? "Match settings" : "Create Match",
    `<p>${editing ? "The host sets the rules for everyone. Changes apply before the next round starts." : "Choose your arena, invite friends, and add bots to fill the match."}</p><div class="form-grid match-rules">${select("visibility","VISIBILITY",[["public","Public · listed for everyone"],["private","Private · invite code only"]],o.visibility || net?.visibility || "public")}${select("map","ARENA",(o.mode==='royale'?[getMap('sunnybreak')]:MAPS).map(m=>[m.id,m.name]),o.map)}${select("mode","GAME MODE",MODES.map(m=>[m.id,m.name]),o.mode)}${select("bots","BOTS",Array.from({length:o.mode==='royale'?16:8},(_,n)=>[n,String(n)]),o.bots)}${select("difficulty","BOT DIFFICULTY",BOT_DIFFICULTIES.map((name,i)=>[i+1,name]),o.difficulty)}<label>TIME LIMIT (MINUTES)<input class="field" id="setup-minutes" type="number" min="1" max="60" step="1" required value="${o.minutes}"></label><label><span id="target-label">${targetLabel(o.mode)}</span><input class="field" id="setup-scoreLimit" type="number" min="1" max="1000" step="1" required value="${o.scoreLimit}"></label>${select("capacity","ROYALE CONTESTANTS",[[2,"2"],[4,"4"],[8,"8"],[12,"12"],[16,"16"]],o.capacity||16)}${select("storm","STORM PACE",[["normal","Normal"],["quick","Quick"]],o.storm||"normal")}${select("fill","FILL EMPTY SEATS",[["off","Use chosen bot count"],["on","Fill to contestant limit"]],o.fill?"on":"off")}</div><p class="hint">${o.mode==='royale'?'Last egg standing wins. Two contestants minimum. All loot is found on Sunnybreak.':'The round ends at the time limit or score target.'} ${o.mode==='royale'?'New players take an available bot’s place. A room full of players cannot be joined.':'Up to 8 players including bots; friends replace bots when full.'}</p><button class="primary" style="margin-top:22px" data-action="${nextRound ? "apply-rematch" : editing ? "save-match-settings" : "create-room"}">${nextRound ? "START NEXT ROUND" : editing ? "SAVE SETTINGS" : "CREATE MATCH"}</button>`, "setup");
  if(editing && !net) $("#setup-visibility").disabled=true;
  const royale=o.mode==='royale';
  for(const key of ['minutes','scoreLimit']){$(`#setup-${key}`).closest('label').hidden=royale;$(`#setup-${key}`).disabled=royale;}
  for(const key of ['capacity','storm'])$(`#setup-${key}`).closest('label').hidden=!royale;
  $('#setup-map').disabled=royale;
  $('#setup-mode').onchange=e=>{
    const visibility=$('#setup-visibility').value;
    const next={...matchOptions({...o,...getOptions(),mode:e.target.value,map:e.target.value==='royale'?'sunnybreak':'yard',bots:e.target.value==='royale'?15:0,scoreLimit:mode(e.target.value).limit}),visibility};
    if(editing){options=next;setupMenu(editing,next);}else{options=next;setupMenu(false);}
  };

}
function getOptions() {
  if (![...document.querySelectorAll('#dialog input[type="number"]')].every(input=>input.disabled||input.reportValidity())) return null;
  return matchOptions({...Object.fromEntries(["map","mode","bots","difficulty","minutes","scoreLimit","capacity","storm","fill"].map(key=>[key,$(`#setup-${key}`).value])),fill:$("#setup-fill").value==='on'});
}
function saveMatchSettings(start = false) {
  if (!sim || state?.phase === "playing") return;
  const next=getOptions();
  if(!next)return;
  const humans=[...sim.players.values()].filter(p=>!p.bot).length;
  if(humans>(next.mode==='royale'?next.capacity:8)){toast('Choose enough contestant seats for everyone in this room.');return;}
  if((sim.options.mode==='royale')!==(next.mode==='royale')){
    const old=sim;sim=next.mode==='royale'?new RoyaleSimulation(next):new Simulation(next);
    for(const p of old.players.values())if(!p.bot)sim.addPlayer(p.id,p);sim.round=old.round;sim.phase=old.phase;
  }else if(!sim.configure(next))return;
  if(net)net.maxConnections=(next.capacity||8)-1;
  if(autoQueue&&next.mode==='royale'&&!start)sim.queueEnds=sim.time+30;
  options=sim.options;
  net?.setVisibility($("#setup-visibility").value);
  state=sim.snapshot();
  net?.broadcast(state);
  if(start) {launchRound();}
  else {closeDialog();renderLobby();}
}
function visibilityLabel() {
  return `Room: ${net?.visibility === "public" ? "public" : "private"} · Make ${net?.visibility === "public" ? "private" : "public"}`;
}
function visibilityButton() {
  return net?.isHost ? `<button class="plain" data-action="toggle-visibility" style="margin:12px 0">${visibilityLabel()}</button>` : "";
}
let roomListRequest = 0;
async function publicRooms() {
  const request = ++roomListRequest;
  modal("Public matches", '<p>Finding arenas…</p>', "public-rooms");
  try {
    const result = await directory.list();
    if (dialogType !== "public-rooms" || request !== roomListRequest) return;
    modal("Public matches", `<p>Open to everyone. Private rooms are only reachable by invite code.</p><button class="icon-btn" data-action="refresh-rooms" aria-label="Refresh public matches">↻</button><div class="public-room-list">${result.rooms.map(r => `<article class="public-room"><div><strong>${esc(r.host)}’s room</strong><p>${esc(getMap(r.map).name)} · ${esc(mode(r.mode).name)}</p><span class="hint">${r.players}/${r.capacity} players · ${r.phase === "playing" ? "In progress" : r.phase === "results" ? "Between rounds" : "In lobby"}</span></div><button class="secondary" data-join-room="${esc(r.code)}" ${r.players >= r.capacity ? "disabled" : ""}>${r.players >= r.capacity ? "Full" : "Join"}</button></article>`).join('') || '<p class="empty-rooms">No public matches yet. Create a room and set it to public.</p>'}</div><button class="primary" data-action="setup">CREATE A ROOM</button>`, "public-rooms");
  } catch(e) {
    if (dialogType === "public-rooms" && request === roomListRequest) modal("Public matches", `<p class="error-box">${esc(e.message)}</p><button class="primary" data-action="refresh-rooms">Try again</button>`, "public-rooms");
  }
}
function joinMenu(code = "") {
  modal(
    "Join your friends",
    `<p>Ask the host for the 8-character room code.</p><label class="setting-label" for="join-code" style="margin:22px 0 8px">ROOM CODE</label><input class="field" id="join-code" placeholder="ABCD-EFGH" value="${esc(code)}" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" style="font-size:1.6rem;letter-spacing:.16em;text-align:center;text-transform:uppercase"><button class="primary" style="margin-top:20px" data-action="join-room">JOIN ROOM</button><p class="hint">Private rooms require an invite code. No account is needed.</p>`,
    "join",
  );
  $("#join-code").onkeydown = (e) => {
    if (e.key === "Enter") joinRoom();
  };
}
function renamePrompt(){
  if(dialogType==='rename'&&dialog.open){
    const button=dialog.querySelector('[data-action="save-room-name"]');button.disabled=false;button.textContent='USE THIS NAME';
    toast('That name is still taken. Choose another one.');return;
  }
  modal('That name is already in this match',`<p>Choose an unused player name to continue.</p><label for="room-name">Player name</label><input id="room-name" class="field" maxlength="18" value="${esc(profile.name)}" autocomplete="off"><button class="primary" data-action="save-room-name">USE THIS NAME</button><button class="plain" data-action="leave">Leave match</button>`,'rename');
  $('#room-name').focus();$('#room-name').select();$('#room-name').onkeydown=e=>{if(e.key==='Enter')actions['save-room-name']();};
}
function roundIntro(){
  if(!state)return;
  dialog.close();dialogType='';paused=true;keys.clear();queuedActions.clear();input.fire=input.aim=false;
  const p=state.players.find(p=>p.id===localId),ranked=state.players.filter(p=>!p.spectating||p.place).sort((a,b)=>b.kills-a.kills||a.deaths-b.deaths||b.points-a.points);
  const place=state.royale?p?.place:p?1+ranked.filter(other=>other.kills>p.kills||other.kills===p.kills&&other.deaths<p.deaths).length:0;
  const win=state.royale?state.royale.winnerId===localId:mode(state.options.mode).teams?state.scores[p?.team]>state.scores[1-p?.team]:place===1;
  const title=state.royale?(win?'VICTORY YOLK ROYALE':place?'YOU PLACED #'+place:'ROUND COMPLETE'):mode(state.options.mode).teams?(state.scores[0]===state.scores[1]?'TEAM DRAW':win?'TEAM VICTORY':'ROUND COMPLETE'):'YOU PLACED #'+place;
  const banner=$('#round-banner');banner.className=win?'victory':'placement';banner.innerHTML=`<span>${state.royale?'LAST EGG STANDING':mode(state.options.mode).name.toUpperCase()}</span><strong>${esc(title)}</strong><p>${!state.royale&&place?'YOUR PLACE #'+place+' · ':''}${p?.kills||0} ELIMINATIONS</p>`;banner.hidden=false;
  if(!state.royale)sound.cue(win?'victory':'round-start');
  resultAt=performance.now()+4200;
}
function callbacks() {
  return {
    getChatState: () => sim ? sim.snapshot() : state,
    onChat: message => chat.receive(message),
    onChatStatus: result => chat.feedback(result),
    onChatReport: report => {
      const text=`${report.reporter} reported ${report.target}: ${report.reason}. Open Pause → Player controls to review.`;
      chat.status.textContent=text;toast(text);
    },
    getCheckpoint:()=>sim?.checkpoint(),
    onHost:(checkpoint,departed)=>{
      sim=(checkpoint.options.mode==='royale'?new RoyaleSimulation(checkpoint.options):new Simulation(checkpoint.options)).restore(checkpoint);
      for(const id of departed)sim.leavePlayer(id);
      state=sim.snapshot();localId=net.id;pendingInputs=[];predicted=null;
      const me=sim.players.get(localId);if(me){input.slot=me.slot;input.yaw=me.yaw;input.pitch=me.pitch;}
      autoQueue=!!sim.queueEnds;lobbyRenderKey='';handleState();
    },
    onNameRequired:()=>renamePrompt(),
    onNameAccepted:()=>{if(dialogType==='rename'){dialog.close();dialogType='';if(screen==='game')void resume();}},
    onJoin: (id, p) => !!sim?.admitPlayer(id,p),
    onLeave: (id) => sim?.leavePlayer(id),
    onPlayerAction: (id, action) => sim?.playerAction(id, action),
    onInput: (id, i) => sim?.setInput(id, i),
    onProfile: (id, p) => sim?.setProfile(id, p),
    onState: (s) => {
      if(s.royale&&!s.royale.loot&&state?.royale)s.royale={...s.royale,loot:state.royale.loot,chests:state.royale.chests};
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
    onStatus: (message) => toast(message),
  };
}
function beginSim() {
  chat.reset();
  sim = options.mode==='royale'?new RoyaleSimulation(options):new Simulation(options);
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
async function createRoom(preset = null, visibilityOverride = null, automatic = false) {
  if (busy) return;
  const next = preset?.mode ? matchOptions(preset) : getOptions();
  if (!next) return;
  options=next;autoQueue=automatic;
  const visibility=visibilityOverride||$('#setup-visibility')?.value||'public';
  beginSim();
  busy = true;
  modal(
    "Opening your room",
    `<div class="spinner"></div><p>Connecting to the room service…</p><button class="plain" data-action="cancel-connect" style="margin-top:18px">Cancel</button>`,
    "connecting",
  );
  const attempt = new Network(callbacks());
  attempt.maxConnections=(options.capacity||8)-1;
  net = attempt;
  try {
    await attempt.host();
    if (attempt !== net) return;
    attempt.setVisibility(visibility);
    if(automatic&&sim instanceof RoyaleSimulation)sim.queueEnds=sim.time+30;
    localId = attempt.id;
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
      `<div class="error-box">${esc(e.message)}</div><button class="primary" data-action="start-local">START LOCAL MATCH</button><button class="plain" data-action="setup" style="margin-top:12px">Try creating a room again</button>`,
      "error",
    );
  } finally {
    busy = false;
  }
}
async function joinRoom(publicCode, quiet=false) {
  if (busy) return;
  const code = cleanCode(typeof publicCode === "string" ? publicCode : $("#join-code")?.value);
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
  chat.reset();
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
    return true;
  } catch (e) {
    if (attempt !== net) return;
    attempt.destroy();
    net = null;
    if(quiet)return false;
    modal(
      "Could not join",
      `<div class="error-box">${esc(e.message)}</div><button class="primary" data-action="join">Check the code & retry</button><button class="plain" data-action="setup" style="margin-top:12px">Create a match</button>`,
      "error",
    );
  } finally {
    busy = false;
  }
}
let lobbyRenderKey = "";
function renderLobby() {
  if (screen !== "lobby") return;
  const roster = state?.players || [],
    o = state?.options || options;
  const key = JSON.stringify([net?.code, net?.visibility, net?.isHost, localId, o, Math.ceil((state?.royale?.queueEnds||0)-(state?.time||0)), roster.map(p => [p.id,p.name,p.team,p.weapon,p.bot])]);
  if (key === lobbyRenderKey) return;
  lobbyRenderKey = key;
  $("#lobby").innerHTML =
    `${titleBar()}<section class="panel lobby-panel"><div class="eyebrow">${net?.visibility === "public" ? "PUBLIC" : "PRIVATE"} ROOM</div><h2 style="margin-top:8px">${o.mode==='royale'?'Next stop: Sunnybreak.':'The gang’s all here.'}</h2>${o.mode==='royale'?`<p class="royale-queue">${state.royale?.queueEnds?'EGGSPRESS DEPARTS IN '+Math.max(0,Math.ceil(state.royale.queueEnds-state.time))+'s':'Drop in together. Last egg standing wins.'}</p>`:''}<div class="room-code">${formatCode(net?.code || "--------")}</div><div class="split-actions"><button class="plain" data-action="copy-code">Copy code</button><button class="plain" data-action="copy-link">Copy invite link</button></div><div class="lobby-meta"><strong>${getMap(o.map).name}</strong><span>·</span><span>${mode(o.mode).name}</span></div><div class="roster">${roster.map((p) => `<div class="roster-row"><b><span class="team-dot ${p.team === 1 ? "coral" : ""}"></span>${esc(p.name)}${p.id === localId ? " (you)" : ""}</b><span>${p.bot ? "BOT" : weapon(p.weapon).name}</span>${net?.isHost && p.id !== localId && !p.bot ? `<button data-kick="${esc(p.id)}">Remove</button>` : ""}</div>`).join("")}</div><p class="hint" style="margin-bottom:18px">${net?.isHost ? `${o.bots} bots will fill available spots. The next player takes over if the host disconnects.` : "Waiting for the host to start. You can choose your loadout while you wait."}</p><p class="hint">${ruleSummary(o)}</p>${net?.isHost ? '<button class="secondary" data-action="match-settings">EDIT MATCH SETTINGS</button>' : ""}${visibilityButton()}<button class="plain" data-action="chat-controls">Player controls & quick chat</button><div class="room-bottom">${net?.isHost ? '<button class="primary" data-action="start-match">START MATCH</button>' : '<button class="primary" data-action="loadout">Choose loadout</button>'}<button class="plain" data-action="leave">Leave</button></div></section>`;
}
function launchRound(){
  if(sim.startRound()===false){toast('Invite another egg or add a bot before launching.');return false;}
  state=sim.snapshot();net?.broadcast(state);enterGame(true);return true;
}
function startLocalMatch() {autoQueue=false;beginSim();launchRound();}
function enterGame(capture = false) {
  resultAt=0;$("#round-banner").hidden=true;
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
  resume(state.options.mode==='royale' && capture);

}
async function resume(capture = true) {
  dialog.close();
  dialogType = "";
  paused = false;
  keys.clear();
  scoreHeld = false;
  queuedActions.clear();
  // Returning from a chat input must restore keyboard focus as well as mouse
  // capture; otherwise the hidden input can keep swallowing menu/move keys.
  $("#world").tabIndex = -1;
  $("#world").focus({preventScroll:true});
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
  sound.cue('spectator-switch');
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
  if(screen!=='game')return;
  if(state?.royale){modal('Take a breather',`<p>${net?'The match keeps running while this menu is open.':'The local match is paused.'} One life per round. Eliminated eggs spectate the survivors.</p><button class="primary" data-action="resume">RESUME</button><div class="split-actions"><button data-action="royale-map">Island map</button><button data-action="royale-inventory">Inventory</button><button data-action="settings">Settings</button></div>${net?'<button class="plain" data-action="chat-controls">Player controls & quick chat</button>':''}${visibilityButton()}<button class="secondary" data-action="leave-confirm">Leave match</button>`,'pause');return;}

  modal(
    "Take a breather",
    `<p>${net ? "The multiplayer match keeps running while this menu is open." : "The local match is paused."}</p><button class="primary" data-action="resume" style="margin-top:22px">RESUME</button><div class="split-actions"><button class="plain" data-action="respawn-player">Respawn</button><button class="plain" data-action="spectate">Spectate</button></div><div class="split-actions"><button class="plain" data-action="loadout">Loadout</button><button class="plain" data-action="settings">Settings</button></div>${net ? '<button class="plain" data-action="chat-controls" style="margin-top:12px">Player controls & quick chat</button>' : ""}${visibilityButton()}${net ? '<button class="plain" data-action="copy-link" style="margin-top:12px">Copy invite link</button>' : ""}<button class="secondary" data-action="leave-confirm" style="margin-top:12px">Leave match</button>`,
    "pause",
  );
}
function leave(confirm = false) {
  resultAt=0;$("#round-banner").hidden=true;damageSources.length=0;
  matchRequest++;autoQueue=false;sound.stopWorld();royaleUI.waypoint=null;royaleUI.root.hidden=true;document.body.classList.remove('in-royale');
  net?.destroy();
  net = null;
  chat.reset();
  sim = null;
  state = null;
  predicted = null;
  screen = "menu";
  paused = true;
  busy = false;
  keys.clear();
  scoreHeld = false;
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
  if(s?.royale)return `<table class="scores"><thead><tr><th>Place</th><th>Egg</th><th>Eliminations</th><th>Status</th></tr></thead><tbody>${[...s.players].sort((a,b)=>(a.place||999)-(b.place||999)).map(p=>`<tr class="${p.id===localId?'local':''}"><td>${p.place?'#'+p.place:'—'}</td><td>${esc(p.name)}${p.bot?' · BOT':''}</td><td>${p.kills}</td><td>${p.health>0?'Alive':p.place?'Eliminated':'Spectator'}</td></tr>`).join('')}</tbody></table>`;

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
  if (roundSaved !== state.round && p && (!state.royale || p.place>0)) {
    roundSaved = state.round;
    stats.matches++;
    stats.kills += p.kills;
    if (
      state.royale ? state.royale.winnerId===p.id : mode(state.options.mode).teams
        ? state.scores[p.team] > state.scores[1 - p.team]
        : state.winner === p.name + " wins"
    )
      stats.wins++;
    save("yolk-stats", stats);
  }
  modal(
    state.royale ? state.royale.winnerId===localId ? "VICTORY YOLK!" : "Round complete" : "That’s a wrap.",
    `<div class="results"><div class="eyebrow">${state.royale?`YOUR PLACEMENT ${p?.place?'#'+p.place:'SPECTATOR'} · ${p?.kills||0} ELIMINATIONS`:`ROUND ${state.round} COMPLETE`}</div><h2 style="margin:12px 0">${esc(state.winner)}</h2>${scoresHTML()}${net ? '<button class="plain" data-action="chat-controls">Player controls & quick chat</button>' : ""}<p class="hint">${ruleSummary(state.options)}</p>${sim || net?.isHost ? '<button class="primary" data-action="rematch">PLAY AGAIN</button>' : "<p>Waiting for the host to start another round.</p>"}<div class="split-actions">${state.royale?'<button class="plain" data-action="royale-queue">Find public match</button>':'<button class="plain" data-action="loadout">Change loadout</button>'}<button class="plain" data-action="leave-confirm">Leave match</button></div></div>`,
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
    roundIntro();
  }
  if (screen === "lobby") renderLobby();
  for (const toggle of document.querySelectorAll('[data-action="toggle-visibility"]')) toggle.textContent = visibilityLabel();
}
function processEvents() {
  if (!state) return;
  for (const e of state.events) {
    if (e.id <= lastEvent) continue;
    lastEvent = e.id;
    if (state.time - e.time > 1.6) continue;
    view.event(e, localId);
    const me = state.players.find((p) => p.id === localId);
    sound.event(e,me,state);
    if(e.type==='royale-eliminated'&&e.player===localId){spectateTarget=me?.killerId;pendingInputs=[];predicted=null;}
    if (e.type === "shot") {
      const distance = me
        ? Math.hypot(e.origin.x - me.x, e.origin.z - me.z)
        : 0;
      sound.shot(e.weapon, distance, e.origin);
    }
    if (e.type === "launch") sound.shot(e.popper?"pip":e.weapon, me&&e.origin?Math.hypot(me.x-e.origin.x,me.z-e.origin.z):0,e.origin);
    if (e.type === "explosion")
      sound.pop(me ? Math.hypot(me.x - e.x, me.z - e.z) : 0,e);
    if (e.type === "hit") {
      if (e.player === localId) {
        sound.hit();
        hitUntil = performance.now() + 150;
      }
      if (e.target === localId) {
        damageFlash=Math.max(damageFlash,.5+Math.min(.35,e.amount/100));
        if(Number.isFinite(e.sourceX)&&Number.isFinite(e.sourceZ)){damageSources.push({x:e.sourceX,z:e.sourceZ,until:performance.now()+1400});if(damageSources.length>5)damageSources.shift();}
      }
    }
    if (e.type === "reload" && e.player === localId) sound.reload(Math.max(.3,(me?.reloadEnd||state.time+1.2)-state.time));
    if (e.type === "pickup" && e.player === localId) {
      sound.pickup();
      notice(
        e.kind === "ammo"
          ? "Ammo restocked"
          : e.kind === "health"
            ? "Shell health restored"
            : "Popper collected",
      );
    }
    if (e.type === "notice") notice(e.text);
    if (e.type === "elimination") {
      sound.death(me ? Math.hypot(me.x-e.x, me.z-e.z) : 0,e);
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
  const watched=p.spectating?state.players.find(k=>k.id===spectateTarget):null;
  royaleUI.update(state,p,watched,controlLabel,paused);
  view.waypoint=royaleUI.waypoint;
  $("#hud-mode").textContent = m.name.toUpperCase();
  $("#hud-map").textContent = getMap(state.options.map).name;
  $("#hud-network").textContent = net
    ? (net.isHost ? "HOST · " : net.latency + " ms · ") + formatCode(net.code)
    : "LOCAL MATCH";
  $("#timer").textContent =
    Math.floor(Math.ceil(state.remaining) / 60) +
    ":" +
    String(Math.ceil(state.remaining) % 60).padStart(2, "0");
  $("#score-blue").textContent = m.teams ? state.scores[0] : "";
  $("#score-coral").textContent = m.teams ? state.scores[1] : "";
  $("#objective").textContent =
    m.id==='royale' ? `${state.royale.alive} ALIVE · ${p.kills} ELIMS · ${p.place?'#'+p.place:'LAST EGG STANDING'}` :
    `FIRST TO ${state.options.scoreLimit} ELIMINATIONS`;
  const vitals=state.royale&&watched?watched:p;
  $("#health").textContent = Math.ceil(vitals.health);
  $("#health-fill").style.width = vitals.health + "%";
  $("#health-fill").style.background = vitals.health < 30 ? "#f99b74" : "#8bdcc5";
  $("#streak").textContent =
    state.time < p.shieldUntil
      ? "Spawn shield · firing ends it"
      : p.streak > 1
          ? p.streak + " elimination streak"
          : "Freshly hatched";
  $('.quick-controls').innerHTML = [['forward','Move'],['reload','Reload'],['popper','Popper'],['swap','Swap']].map(([id,label]) => `<span><kbd>${esc(controlLabel(id))}</kbd> ${label}</span>`).join('') + '<span><kbd>Esc</kbd> Menu</span>';
  $("#gun-name").textContent = gun(p).name;
  $("#ammo").textContent = p.ammo[p.slot];
  $("#reserve").textContent = p.reserve[p.slot];
  $("#ammo-extra").textContent =
    p.reloadEnd > state.time
      ? "RELOADING…"
      : `${p.poppers} poppers · ${p.slot === 0 ? `${controlLabel("sidearm")} → sidearm` : `${controlLabel("primary")} → primary`}`;
  $("#respawn").style.display =
    p.health <= 0 && !p.spectating && state.phase === "playing" ? "block" : "none";
  const killer = p.health <= 0 && state.players.find(k => k.id === p.killerId);
  $("#spectator-stats").textContent = killer
    ? `${killer.health > 0 ? "Spectating" : "Eliminated"} ${killer.name} · Shell health ${Math.ceil(killer.health)} · ${gun(killer).name} · ${killer.kills} K / ${killer.deaths} D · ${Math.floor(killer.points)} pts`
    : "";
  const watching = !!p.spectating && state.phase === "playing";
  $("#spectate-panel").hidden = !watching;
  $("#hud").classList.toggle("spectating", watching);
  const target = state.players.find(k => k.id === spectateTarget);
  $("#spectate-info").textContent = target && watching
    ? `${target.name} · Shell health ${Math.ceil(target.health)} · ${state.royale?itemInfo(target.inventory?.[target.slot]).name:gun(target).name} · ${target.kills} K / ${target.deaths} D`
    : "Waiting for a player to spawn…";
  const delay = Math.max(0, Math.ceil(p.respawnAt - state.time));
  $("#spawn-heading").textContent = p.awaitingEntry ? "READY TO HATCH" : "SHELL HEALTH DEPLETED";
  $("#spawn-status").textContent = p.spawnRequested
    ? (delay ? `Entering in ${delay}…` : "Entering the yard…")
    : delay ? `Respawn available in ${delay}` : "Ready when you are";
  $("#spawn-button").textContent = p.awaitingEntry ? "Enter the Yard" : "Respawn";
  $("#spawn-button").disabled = !!p.spawnRequested || delay > 0;
  if (p.health > 0) spawnIntentUntil = 0;
  if (p.health <= 0 && !p.spawnRequested && performance.now() > spawnIntentUntil && document.pointerLockElement)
    document.exitPointerLock();
  const armed=!state.royale||p.flight==='ground'&&!!p.inventory?.[p.slot]?.weapon;
  const aiming = armed &&
    (actionDown("aim") || touch.aim) &&
    p.health > 0 &&
    !paused &&
    p.reloadEnd <= state.time;
  $("#crosshair").style.display =
    p.health > 0 && armed && !paused && !aiming ? "block" : "none";
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
    ? `${gun(p).name.toUpperCase()} / OPTIC ${gun(p).magnification||2.5}×`
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
function royaleHome(){modal('Yolk Royale',`<div class="royale-brief"><div class="eyebrow">SUNNYBREAK ISLAND</div><h3>One island. One surviving egg.</h3><p>Board the Eggspress, choose your drop, and build a five-slot loadout. Find shields, healing, impulse eggs and launch nests. Keep moving as the storm closes.</p><p class="hint">Solo · 16 contestants · Nine districts · One life</p></div><button class="primary" data-action="royale-queue">FIND PUBLIC MATCH</button><button class="secondary" data-action="royale-custom">CREATE PUBLIC / PRIVATE MATCH</button><button class="plain" data-action="royale-local">PLAY LOCAL WITH BOTS</button><p class="hint">Public matchmaking fills empty seats with bots after a 30-second lobby. Private hosts choose their rules. New players replace available bots. Hosting transfers automatically if the host leaves.</p>`,'royale-home');}
async function quickRoyale(){
 if(state)leave(false);
 const request=++matchRequest;modal('Finding your flight','<div class="spinner"></div><p>Finding a waiting Yolk Royale match…</p><button data-action="cancel-connect">Cancel</button>','matchmaking');
 try{
   let rooms=(await directory.list()).rooms;
   if(request!==matchRequest)return;
   for(let pass=0;pass<2;pass++){
     for(const room of queueCandidates(rooms).slice(0,3)){
       if(request!==matchRequest)return;
       if(await joinRoom(room.code,true)){sound.cue('queue-found');return;}
     }
     if(pass===0){await new Promise(resolve=>setTimeout(resolve,400+Math.random()*600));rooms=(await directory.list()).rooms;}
   }
   if(request!==matchRequest)return;
   await createRoom({mode:'royale',bots:15,capacity:16,fill:true},'public',true);
 }catch(e){if(request===matchRequest)modal('Matchmaking unavailable',`<p class="error-box">${esc(e.message)}</p><button class="primary" data-action="royale-local">PLAY LOCAL WITH BOTS</button><button data-action="royale-queue">Try again</button>`,'error');}
}
function royaleMap(){if(!state?.royale)return;modal('Sunnybreak Island',royaleUI.mapHTML(),'royale-map');royaleUI.drawMap($('#royale-fullmap'),state,state.players.find(p=>p.id===localId),true);}
function royaleInventory(){if(!state?.royale)return;const p=state.players.find(p=>p.id===localId);royaleUI.inventoryKey='';modal('INVENTORY',royaleUI.inventoryHTML(p),'royale-inventory');royaleUI.updateInventory(p);}
function inventoryAction(action,index,from){
 const p=state?.players.find(p=>p.id===localId);if(!state?.royale||!p||p.health<=0)return;
 const selected=Number.isInteger(from)?from:input.slot;
 if(action==='slot')input.slot=index;
 if(action==='swap'){if(input.slot===selected)input.slot=index;else if(input.slot===index)input.slot=selected;}
 const command=action==='slot'?`inventory-select-${index}`:action==='swap'?`inventory-swap-${selected}-${index}`:`inventory-${action}-${selected}`;
 if(sim){sim.playerAction(localId,command);state=sim.snapshot();}else net?.send({type:'player-action',action:command});
 if(dialogType==='royale-inventory')royaleUI.updateInventory(state.players.find(p=>p.id===localId));
}
const actions = {
 'royale-home':royaleHome,
 'royale-queue':quickRoyale,
 'royale-custom':()=>{options=matchOptions({mode:'royale'});setupMenu();},
 'royale-local':()=>{options=matchOptions({mode:'royale',bots:15,fill:true});startLocalMatch();},
 'royale-map':royaleMap,
 'royale-inventory':royaleInventory,
 'royale-clear-marker':()=>{royaleUI.waypoint=null;},
 'royale-jump':()=>{if(paused)resume(false);queuedActions.add('jump');sound.unlock();},
 'royale-drop':()=>inventoryAction('drop'),
 'royale-drop-one':()=>inventoryAction('drop-one'),
 'royale-split':()=>inventoryAction('split'),

  chat: () => chat.open(),
  'chat-controls':()=>{dialog.close();dialogType='';chat.showControls();},
  'save-room-name':()=>{
    const raw=$('#room-name').value;const checked=moderateText(raw,{name:true});
    if(!checked.ok||!raw.trim()){toast('Choose another player name.');return;}
    profile=safeProfile({...profile,name:raw});save('yolk-profile',profile);
    if(net){const button=dialog.querySelector('[data-action="save-room-name"]');button.disabled=true;button.textContent='CHECKING NAME…';}
    if(net)net.submitName(profile);else if(sim?.setProfile(localId,profile)!==false){dialog.close();dialogType='';void resume();}else renamePrompt();
  },
  'royale-inspect':()=>{royaleUI.inspect=!royaleUI.inspect;royaleUI.updateInventory(state.players.find(p=>p.id===localId));},
  updates: () => modal("Update history", RELEASES.map(r =>
    `<article class="release-note"><div class="eyebrow">UPDATE ${esc(r.number)}</div><h3>${esc(r.title)}</h3><ul>${r.changes.map(c => `<li>${esc(c)}</li>`).join("")}</ul></article>`).join("")),
  "enter-yard": () => playerAction(state?.players.find(p => p.id === localId)?.awaitingEntry ? "rejoin" : "respawn"),
  setup: () => setupMenu(false),
  "match-settings": () => setupMenu(true),
  "save-match-settings": () => saveMatchSettings(),
  "apply-rematch": () => saveMatchSettings(true),
  "start-local": startLocalMatch,
  "create-room": createRoom,
  "join-room": joinRoom,
  join: () => joinMenu(),
  loadout: loadoutMenu,
  customize: customizeMenu,
  "shuffle-egg": () => {
    const pick = (items) => Math.floor(Math.random() * items.length);
    Object.assign(profile, {color: COLORS[pick(COLORS)], accent: COLORS[pick(COLORS)], hat: pick(HATS), pattern: pick(PATTERNS), finish: pick(FINISHES), eyewear: pick(EYEWEAR)});
    remember(); customizeMenu();
  },
  "reset-egg": () => {
    profile = safeProfile({name: profile.name, weapon: profile.weapon, eyewear: NO_EYEWEAR});
    remember(); customizeMenu();
  },
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
    launchRound();
  },
  rematch: () => setupMenu(true),
  "public-rooms": () => publicRooms(),
  "refresh-rooms": () => publicRooms(),
  "toggle-visibility": () => {
    if (!net?.isHost) return;
    net.setVisibility(net.visibility === "public" ? "private" : "public");
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
      `<p>Yolk Yard is an original, independent egg arena shooter. Its maps, characters, blasters, UI, and sounds were created for this game.</p><p style="margin-top:14px">3D rendering: Three.js (MIT). Multiplayer connections: PeerJS (MIT). This game is not affiliated with Shell Shockers or Blue Wizard Digital.</p><p style="margin-top:14px">Settings and match totals stay in this browser. Rooms share your chosen name and game state with other players. Public rooms also share their room code and details in the directory. Filtered text chat is shared only within your room or team. Chat history stays in memory and clears when you leave. Reports notify the room host. No camera or microphone.</p><p class="hint">Version 2.0 · All gameplay code is included in the project.</p>`,
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
  if (b.dataset.customTab) { customTab = b.dataset.customTab; customizeMenu(); }
  if (b.dataset.cosmetic) {
    const key = b.dataset.cosmetic;
    if (["color", "accent", "hat", "pattern", "finish", "eyewear"].includes(key)) {
      profile = safeProfile({...profile, [key]: b.dataset.value});
      remember(); customizeMenu();
      document.querySelector(`[data-cosmetic="${key}"][data-value="${b.dataset.value}"]`)?.focus();
    }
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
  if (b.dataset.joinRoom) joinRoom(b.dataset.joinRoom);
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
  sound.setVolumes(settings);
  view.setQuality();
});
dialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  if (dialogType === "connecting") {
    leave();
    return;
  }
  if (dialogType === "results" || dialogType === "rename") return;
  if (dialogType === "pause" || dialogType === "ready") resume();
  else closeDialog();
});
document.addEventListener("pointerlockchange", () => {
  if (
    !document.pointerLockElement &&
    screen === "game" &&
    !paused &&
    !chat.opened &&
    state?.players.find(p => p.id === localId)?.health > 0 &&
    !matchMedia("(pointer:coarse)").matches
  )
    pauseMenu();
});
function pressControl(code) {
  keys.add(code);
  for (const action of ['jump', 'fire', 'reload', 'popper', 'interact']) {
    if (settings.keybinds[action].includes(code)) queuedActions.add(action);
  }
  if (settings.keybinds.primary.includes(code)) input.slot = 0;
  if (settings.keybinds.sidearm.includes(code)) input.slot = 1;
  if (settings.keybinds.swap.includes(code)) input.slot = state?.royale ? (input.slot+1)%5 : 1-input.slot;
  if(state?.royale){
    for(let i=3;i<=5;i++)if(settings.keybinds['slot'+i].includes(code))input.slot=i-1;
    if(settings.keybinds.map.includes(code))royaleMap();
    if(settings.keybinds.inventory.includes(code))royaleInventory();
    if(settings.keybinds.drop.includes(code))inventoryAction('drop');
  }
  scoreHeld = actionDown('scores');
}
dialog.addEventListener('click', e => {
  const reset = e.target.closest('[data-reset-slider]');
  if (reset) {
    resetSliders(settings, reset.dataset.resetSlider);
    for (const [id] of SLIDERS) { $('#'+id).value=settings[id]; $('#out-'+id).value=settings[id]; }
    save('yolk-settings', settings); sound.setVolumes(settings); view.setQuality();
  }
  const button = e.target.closest('[data-bind]');
  if (button) {
    bindingCapture = { action: button.dataset.bind, slot: Number(button.dataset.bindSlot) };
    dialog.querySelectorAll('[data-bind]').forEach(b => b.classList.toggle('listening', b === button));
    $('#binding-help').textContent = 'Press a key or mouse button. Esc cancels; Delete clears.';
  } else if (e.target.closest('[data-reset-bindings]')) {
    settings.keybinds = normalizeBindings();
    save('yolk-settings', settings);
    settingsMenu();
  }
});
function captureBinding(e) {
  if (!bindingCapture || !dialog.open) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (e.repeat) return;
  const code = e.type === 'mousedown' ? `Mouse${e.button}` : e.code;
  if (code === 'Escape') { settingsMenu(); return; }
  const clear = code === 'Delete' || code === 'Backspace';
  if (!clear && !validBinding(code)) {
    $('#binding-help').textContent = 'Choose a letter, number, navigation key, modifier, or mouse button.';
    return;
  }
  const { action, slot } = bindingCapture;
  const conflict = CONTROLS.find(([id]) => settings.keybinds[id].some((key, i) => key === code && (id !== action || i !== slot)));
  if (!clear && conflict) {
    $('#binding-help').textContent = `${bindingLabel(code)} is already assigned to ${conflict[1]}. Clear that binding first, or choose another.`;
    return;
  }
  settings.keybinds[action][slot] = clear ? null : code;
  save('yolk-settings', settings);
  settingsMenu();
}
document.addEventListener('keydown', captureBinding, true);
document.addEventListener('mousedown', captureBinding, true);
document.addEventListener("keydown", (e) => {
  if (chat.opened || e.target.matches("input,select,textarea,[contenteditable=true]")) return;
  const panel = screen==='game' && state?.royale && (!paused || ['royale-map','royale-inventory'].includes(dialogType))
    ? royalePanelAction(e.code, settings.keybinds, dialog.open ? dialogType : '') : null;
  if (panel) {
    e.preventDefault(); if (e.repeat) return;
    if (panel==='close') resume(); else if (panel==='royale-map') royaleMap(); else royaleInventory();
    return;
  }
  if (dialog.open) return;
  if (settings.keybinds.chat.includes(e.code) && net?.ready && screen!=="menu") {
    e.preventDefault();if(!e.repeat)chat.open();return;
  }
  if (screen !== 'game') return;
  if (e.code === 'Escape') {
    e.preventDefault();
    if (!e.repeat) pauseMenu();
    return;
  }
  if (paused) return;
  if (Object.values(settings.keybinds).some(codes => codes.includes(e.code))) e.preventDefault();
  if (!e.repeat) pressControl(e.code);
});
document.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  scoreHeld = actionDown('scores');
});
window.addEventListener("blur", () => {
  keys.clear();
  scoreHeld = false;
  queuedActions.clear();
  input.fire = false;
  input.aim = false;
  touch.fire = false;
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    keys.clear();
    scoreHeld = false;
    queuedActions.clear();
    input.fire = false;
    if (screen === "game" && !net && !paused) pauseMenu();
  }
});
$("#world").addEventListener("mousedown", (e) => {
  if (screen !== "game" || paused || dialog.open || chat.opened) return;
  e.preventDefault();
  pressControl(`Mouse${e.button}`);
});
document.addEventListener("mouseup", (e) => {
  keys.delete(`Mouse${e.button}`);
  scoreHeld = actionDown('scores');
});
function aimSensitivity() {
  const p=state?.players.find(p=>p.id===localId);
  const aiming = (actionDown("aim") || touch.aim)&&(!p?.inventory||!!p.inventory[p.slot]?.weapon);
  return aiming ? settings.scopeSensitivity : 1;
}
document.addEventListener("mousemove", (e) => {
  if (
    screen !== "game" ||
    paused ||
    !document.pointerLockElement || chat.opened
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
document.addEventListener('click',e=>{
 const slot=e.target.closest('[data-royale-slot]'),swap=e.target.closest('[data-royale-swap]');
 if(slot)inventoryAction('slot',Number(slot.dataset.royaleSlot));
 if(swap)inventoryAction('swap',Number(swap.dataset.royaleSwap));
 if(e.target.id==='royale-fullmap'){
  const rect=e.target.getBoundingClientRect();royaleUI.waypoint={x:(e.clientX-rect.left)/rect.width*512-256,z:(e.clientY-rect.top)/rect.height*512-256};sound.cue('ui-select');
 }
 if(e.target.closest('button')){sound.unlock();sound.cue('ui-select',null,.45);}
});
// Native desktop dragging, touch dragging, and keyboard reordering share one action.
let touchDrag=null;
dialog.addEventListener('dragstart',e=>{const slot=e.target.closest('[data-royale-slot]');if(!slot)return;royaleUI.dragging=true;e.dataTransfer.setData('text/plain',slot.dataset.royaleSlot);e.dataTransfer.effectAllowed='move';slot.classList.add('dragging');});
dialog.addEventListener('dragover',e=>{if(e.target.closest('[data-royale-slot]')){e.preventDefault();e.dataTransfer.dropEffect='move';}});
dialog.addEventListener('drop',e=>{const slot=e.target.closest('[data-royale-slot]');if(!slot)return;e.preventDefault();const from=Number(e.dataTransfer.getData('text/plain')),to=Number(slot.dataset.royaleSlot);royaleUI.dragging=false;if(Number.isInteger(from)&&from>=0&&from<5&&from!==to)inventoryAction('swap',to,from);});
dialog.addEventListener('dragend',()=>{royaleUI.dragging=false;royaleUI.inventoryKey='';royaleUI.updateInventory(state?.players.find(p=>p.id===localId));});
dialog.addEventListener('pointerdown',e=>{const slot=e.target.closest('[data-royale-slot]');if(slot&&e.pointerType==='touch')touchDrag={from:Number(slot.dataset.royaleSlot),x:e.clientX,y:e.clientY};});
dialog.addEventListener('pointermove',e=>{if(touchDrag&&Math.hypot(e.clientX-touchDrag.x,e.clientY-touchDrag.y)>8){royaleUI.dragging=true;e.preventDefault();}},{passive:false});
dialog.addEventListener('pointerup',e=>{if(!touchDrag)return;const slot=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-royale-slot]'),from=touchDrag.from;touchDrag=null;const dragged=royaleUI.dragging;royaleUI.dragging=false;if(dragged&&slot&&Number(slot.dataset.royaleSlot)!==from)inventoryAction('swap',Number(slot.dataset.royaleSlot),from);});
dialog.addEventListener('pointercancel',()=>{touchDrag=null;royaleUI.dragging=false;});
dialog.addEventListener('keydown',e=>{if(dialogType!=='royale-inventory')return;const slot=e.target.closest('[data-royale-slot]');if(slot&&e.altKey&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const from=Number(slot.dataset.royaleSlot),to=(from+(e.key==='ArrowRight'?1:4))%5;inventoryAction('swap',to,from);dialog.querySelector(`[data-royale-slot="${to}"]`)?.focus();}});
document.addEventListener('wheel',e=>{if(screen==='game'&&state?.royale&&!paused&&!dialog.open&&!chat.opened){e.preventDefault();input.slot=(input.slot+(e.deltaY>0?1:4))%5;}},{passive:false});
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
  const active = !net?.migrating && screen === "game" && !paused && !dialog.open && !chat.opened && state?.players.find(p => p.id === localId)?.health > 0;
  const nextInput = {
    seq: ++seq,
    yaw: input.yaw,
    pitch: input.pitch,
    forward: active
      ? Number(actionDown("forward")) -
        Number(actionDown("back")) +
        touch.y
      : 0,
    strafe: active
      ? Number(actionDown("right")) -
        Number(actionDown("left")) +
        touch.x
      : 0,
    jump:
      active && (actionDown("jump") || touch.jump || queuedActions.has("jump")),
    fire: active && (actionDown("fire") || touch.fire || queuedActions.has("fire")),
    aim: active && (actionDown("aim") || touch.aim),
    reload:
      active &&
      (actionDown("reload") || touch.reload || queuedActions.has("reload")),
    popper:
      active &&
      (actionDown("popper") ||
        touch.popper ||
        queuedActions.has("popper")),
    slot: input.slot,
    sprint:active&&(actionDown('sprint')||touch.sprint),
    interact:active&&(actionDown('interact')||touch.interact||queuedActions.has('interact')),
    drop:active&&queuedActions.has('drop'),swapSlot:active?swapSlot:-1,
  };
  swapSlot=-1;
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
      if (!(paused && !net && screen === "game" && !['royale-inventory','royale-map'].includes(dialogType))) {
        sim.setInput(localId, i);
        sim.tick(1 / 60);
      }
    } else if (net?.ready && !net.migrating && state?.phase === "playing") {
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
    if(autoQueue&&screen==='lobby'&&sim.queueEnds&&dialogType!=='setup'){
      const humans=[...sim.players.values()].filter(p=>!p.bot).length;
      if(sim.time>=sim.queueEnds||humans>=sim.options.capacity)launchRound();
    }
    if (net?.isHost && broadcastClock >= (state.royale?.1:.05)) {
      net.broadcast(state); broadcastClock = 0;
    }

    if (state.phase === "results" && lastPhase !== "results") {
      lastPhase = "results";
      roundIntro();
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
  sound.update(state,me?.spectating?state.players.find(p=>p.id===spectateTarget)||me:me,dt,screen==='game'&&!(!net&&paused));
  let renderPlayer = predicted;
  if (sim && me) {
    renderPlayer = {
      ...me,
      yaw: input.yaw,
      pitch: input.pitch,
      moving: me.moving,
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
    !paused && !chat.opened && (actionDown("aim") || touch.aim),
    profile,
  );
  if (hudClock > 0.06) {
    chat.update();
    hud();
    hudClock = 0;
  }
  if(resultAt&&now>=resultAt){resultAt=0;$('#round-banner').hidden=true;if(state?.phase==='results')resultsMenu();}
  const current=state?.players.find(p=>p.id===localId);
  while(damageSources[0]?.until<now)damageSources.shift();
  $('#damage-directions').innerHTML=current?damageSources.map(source=>{
    const dx=source.x-current.x,dz=source.z-current.z,yaw=input.yaw;
    const angle=Math.atan2(dx*Math.cos(yaw)-dz*Math.sin(yaw),-dx*Math.sin(yaw)-dz*Math.cos(yaw))*180/Math.PI;
    return `<i class="damage-direction" style="transform:rotate(${angle}deg);opacity:${Math.min(1,(source.until-now)/500)}"></i>`;
  }).join(''):'';
  $('#hud').classList.toggle('low-health',!!current&&current.health>0&&current.health<25);
  damageFlash = Math.max(0, damageFlash - dt * 1.5);
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
    chatRead: () => ({rows:chat.inbox.rows,open:chat.opened,muted:[...chat.inbox.muted],chatEnabled:net?.chatEnabled}),
    chatPacket: packet => net?.send(packet),
    chatInject: message => {for(const conn of net?.connections.values()||[])conn.send({type:"chat-message",message});},
    checkUpdate: () => updates.check(),
    read: () => ({
      state,
      localId,
      host:!!net?.isHost,
      migrating:!!net?.migrating,
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
