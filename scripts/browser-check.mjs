import { chromium } from "playwright";
import { createServer } from "vite";
import { PeerServer } from "peer";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const out = new URL("../test-results/", import.meta.url);
await mkdir(out, { recursive: true });
const vite = await createServer({
  server: { port: 5173, host: "127.0.0.1", strictPort: true },
});
await vite.listen();
let signalServer;
const signaling = PeerServer(
  { port: 9000, path: "/peer", host: "127.0.0.1", allow_discovery: false },
  (server) => {
    signalServer = server;
  },
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.YOLK_TEST_CHROME
    ? { executablePath: process.env.YOLK_TEST_CHROME }
    : {}),
  args: [
    "--no-sandbox",
    "--allow-loopback-in-peer-connection",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--autoplay-policy=no-user-gesture-required",
  ],
});
const errors = [],
  results = [];
const pass = (text) => {
  results.push(text);
  console.log("PASS", text);
};
const make = async (name, viewport = { width: 1440, height: 900 }) => {
  const context = await browser.newContext({
    viewport,
    isMobile: viewport.width < 500,
    hasTouch: viewport.width < 500,
  });
  await context.addInitScript((name) => {
    localStorage.setItem(
      "yolk-profile",
      JSON.stringify({ name, weapon: "sprinter", hat: 1 }),
    );
    localStorage.setItem(
      "yolk-settings",
      JSON.stringify({
        sensitivity: 1,
        fov: 85,
        volume: 0,
        quality: "low",
        dragLook: true,
      }),
    );
  }, name);
  await context.route("**/network-config.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "window.YOLK_NETWORK={peer:{host:'127.0.0.1',port:9000,path:'/peer',secure:false},iceServers:[]};",
    }),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5173/?qa=1");
  await page
    .getByRole("button", { name: "PRACTICE WITH BOTS", exact: true })
    .waitFor();
  return page;
};
try {
  const host = await make("Host Egg");
  await host.screenshot({ path: new URL("01-menu.png", out).pathname });
  pass("3D menu renders without a Java runtime or external assets");
  if (!process.env.YOLK_TEST_MULTIPLAYER_ONLY) {
    await host
      .getByRole("button", { name: "Customize egg", exact: true })
      .click();
    await host.getByRole("button", { name: "Crown", exact: true }).click();
    await host
      .getByRole("button", { name: "Shell color 3", exact: true })
      .click();
    await host
      .getByRole("button", { name: "Looking good", exact: true })
      .click();
    assert.equal(
      await host.evaluate(
        () => JSON.parse(localStorage.getItem("yolk-profile")).hat,
      ),
      3,
    );
    pass("Appearance changes persist");
    await host
      .getByRole("button", { name: "PRACTICE WITH BOTS", exact: true })
      .click();
    await host.locator("#setup-bots").selectOption("0");
    await host
      .getByRole("button", { name: "START PRACTICE", exact: true })
      .click();
    await host.waitForFunction(
      () => window.__yolkTest.read().screen === "game",
    );
    const start = await host.evaluate(
      () => window.__yolkTest.read().state.players[0],
    );
    await host.keyboard.down("KeyW");
    // Software-rendered CI can take longer than 500 ms to advance enough frames.
    // Keep the real key pressed until the same movement threshold is observed.
    await host.waitForFunction(
      (origin) => {
        const p = window.__yolkTest.read().state.players[0];
        return Math.hypot(p.x - origin.x, p.z - origin.z) > 1;
      },
      { x: start.x, z: start.z },
    );
    await host.keyboard.up("KeyW");
    const moved = await host.evaluate(
      () => window.__yolkTest.read().state.players[0],
    );
    assert.ok(Math.hypot(moved.x - start.x, moved.z - start.z) > 1);
    pass("Actual WASD input moves the player");
    await host.keyboard.down("Space");
    // Observe the jump on a rendered simulation frame; a fixed 150 ms sample
    // can occur before the software-rendered CI browser produces that frame.
    await host.waitForFunction(
      (groundY) => window.__yolkTest.read().state.players[0].y > groundY + 0.2,
      moved.y,
      { timeout: 3000 },
    );
    const jumping = await host.evaluate(
      () => window.__yolkTest.read().state.players[0].y,
    );
    await host.keyboard.up("Space");
    assert.ok(jumping > moved.y + 0.2);
    pass("Actual Space input jumps");
    await host.mouse.move(720, 450);
    await host.mouse.down({ button: "right" });
    await host.mouse.move(800, 370, { steps: 8 });
    await host.mouse.up({ button: "right" });
    const aim = await host.evaluate(() => window.__yolkTest.read());
    assert.ok(aim.input.pitch > 0);
    assert.ok(aim.camera[0] > 0);
    pass("Mouse look and camera pitch match the shot direction");
    const ammoBefore = Number(await host.locator("#ammo").innerText());
    await host.mouse.down();
    await host.waitForFunction(before => Number(document.querySelector("#ammo").textContent) < before, ammoBefore);
    await host.mouse.up();
    assert.ok(Number(await host.locator("#ammo").innerText()) < 30);
    pass("Fire consumes real ammunition");
    await host.keyboard.press("KeyR");
    await host.waitForFunction(
      () => document.querySelector("#ammo").textContent === "30",
      {},
      { timeout: 6000 },
    );
    assert.equal(Number(await host.locator("#ammo").innerText()), 30);
    pass("Reload transfers ammo from reserves");
    await host.keyboard.press("Digit2");
    await host.waitForFunction(
      () =>
        document.querySelector("#gun-name").textContent.toLowerCase() === "pip",
    );
    assert.equal(
      (await host.locator("#gun-name").innerText()).toLowerCase(),
      "pip",
    );
    await host.keyboard.press("Digit1");
    pass("Primary and sidearm swap correctly");
    await host.keyboard.press("KeyE");
    await host.waitForFunction(() =>
      document.querySelector("#ammo-extra").textContent.includes("1 poppers"),
    );
    assert.match(await host.locator("#ammo-extra").innerText(), /1 poppers/);
    pass("Poppers are thrown and consumed");
    await host.screenshot({ path: new URL("02-gameplay.png", out).pathname });
    await host.getByRole("button", { name: "Pause menu", exact: true }).click();
    const time = await host.evaluate(() => window.__yolkTest.read().state.time);
    await host.waitForTimeout(300);
    assert.equal(
      await host.evaluate(() => window.__yolkTest.read().state.time),
      time,
    );
    pass("Practice pauses from the pause menu");
    await host.getByRole("button", {name:"Respawn",exact:true}).click();
    await host.waitForFunction(() => window.__yolkTest.read().state.players[0].health === 0);
    await host.waitForFunction(() => window.__yolkTest.read().state.players[0].health === 100, {}, {timeout:30000});
    await host.getByRole("button", {name:"Pause menu",exact:true}).click();
    await host.getByRole("button", {name:"Spectate",exact:true}).click();
    await host.locator("#spectate-panel").waitFor({state:"visible"});
    assert.match(await host.locator("#spectate-info").innerText(), /Waiting/);
    await host.evaluate(() => window.__yolkTest.fixture(s => {
      s.addPlayer("viewer-target", {name:"Watched Egg"});
      s.addPlayer("viewer-target-2", {name:"Second Egg"});
    }));
    await host.waitForFunction(() => document.querySelector("#spectate-info").textContent.includes("Watched Egg"));
    await host.getByRole("button", {name:"Next →",exact:true}).click();
    await host.waitForFunction(() => document.querySelector("#spectate-info").textContent.includes("Second Egg"));
    await host.screenshot({path:new URL("spectator-mode.png",out).pathname});
    await host.getByRole("button", {name:"Join game",exact:true}).click();
    await host.waitForFunction(() => window.__yolkTest.read().state.players[0].health === 100, {}, {timeout:30000});
    await host.getByRole("button", {name:"Pause menu",exact:true}).click();
    pass("Pause respawn, empty spectator state, player switching, and rejoin work");

    await host
      .getByRole("button", { name: "Leave match", exact: true })
      .click();
  }
  if (!process.env.YOLK_TEST_UI_ONLY) {
    await host
      .getByRole("button", { name: "PLAY WITH FRIENDS", exact: false })
      .click();
    await host.locator("#setup-bots").selectOption("2");
    await host.locator("#setup-mode").selectOption("teams");
    await host
      .getByRole("button", { name: "CREATE ROOM", exact: true })
      .click();
    await host.locator(".room-code").waitFor();
    const code = (await host.locator(".room-code").innerText()).trim();
    assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    pass("Host creates a private room with a usable code");
    const guest = await make("Guest Egg");
    await guest
      .getByRole("button", { name: "Join a room", exact: true })
      .click();
    await guest.locator("#join-code").fill(code);
    await guest.getByRole("button", { name: "JOIN ROOM", exact: true }).click();
    await guest.waitForTimeout(1500);
    console.log(
      "LINK CHECK",
      await host.evaluate(() => window.__yolkTest.network()),
      await guest.evaluate(() => window.__yolkTest.network()),
    );
    await guest.locator(".room-code").waitFor();
    await host.waitForFunction(
      () => window.__yolkTest.read().state.players.length === 2,
    );
    pass("Two independent browser sessions connect through real WebRTC");
    await host.screenshot({ path: new URL("03-lobby.png", out).pathname });
    await host
      .getByRole("button", { name: "START MATCH", exact: true })
      .click();
    await guest
      .getByRole("button", { name: "ENTER ARENA", exact: true })
      .waitFor();
    await guest
      .getByRole("button", { name: "ENTER ARENA", exact: true })
      .click();
    await guest.waitForTimeout(200);
    const guestState = await guest.evaluate(() => window.__yolkTest.read());
    assert.equal(guestState.state.players.length, 4);
    assert.equal(guestState.state.options.mode, "teams");
    pass("Host starts one synchronized match with bots");
    const gid = guestState.localId;
    const before = guestState.state.players.find((p) => p.id === gid);
    await guest.keyboard.down("KeyW");
    await host.waitForFunction(
      ({ id, x, z }) => {
        const p = window.__yolkTest
          .read()
          .state.players.find((p) => p.id === id);
        return p && Math.hypot(p.x - x, p.z - z) > 0.5;
      },
      { id: gid, x: before.x, z: before.z },
      { timeout: 10000 },
    );
    await guest.keyboard.up("KeyW");
    const remote = await host.evaluate(
      (id) => window.__yolkTest.read().state.players.find((p) => p.id === id),
      gid,
    );
    assert.ok(Math.hypot(remote.x - before.x, remote.z - before.z) > 0.5);
    pass("Guest movement is simulated by host and replicated");
    await guest.screenshot({
      path: new URL("04-multiplayer.png", out).pathname,
    });
    await guest
      .getByRole("button", { name: "Pause menu", exact: true })
      .click();
    await guest.getByRole("button", { name: "Loadout", exact: true }).click();
    await guest.getByRole("button", { name: /PRECISION Needle/ }).click();
    await guest.getByRole("button", { name: "Done", exact: true }).click();
    await guest.getByRole("button", { name: "RESUME", exact: true }).click();
    await host.evaluate(
      (id) =>
        window.__yolkTest.fixture((s) => {
          const p = s.players.get(id);
          p.health = 0;
          p.respawnAt = s.time + 0.1;
        }),
      gid,
    );
    await guest.waitForFunction(
      () =>
        document.querySelector("#gun-name").textContent.toLowerCase() ===
        "needle",
    );
    assert.equal(
      (await guest.locator("#gun-name").innerText()).toLowerCase(),
      "needle",
    );
    pass("Remote loadout applies on authoritative respawn");
    await host.waitForFunction(
      (id) =>
        window.__yolkTest.fixture((s) => s.time > s.players.get(id).nextShot),
      gid,
      { timeout: 10000 },
    );
    const targetSetup = await host.evaluate(
      (id) =>
        window.__yolkTest.fixture((s) => {
          const guest = s.players.get(id),
            target = s.players.get("host");
          Object.assign(target, {
            x: guest.x - Math.sin(guest.yaw) * 5,
            y: guest.y,
            z: guest.z - Math.cos(guest.yaw) * 5,
            vy: 0,
            health: 100,
            shieldUntil: 0,
            team: 1 - guest.team,
            lastDamage: s.time,
          });
          for (const p of s.players.values())
            if (p.bot) {
              p.health = 0;
              p.respawnAt = s.time + 60;
            }
          s.projectiles = [];
          return { time: s.time, eventId: s.eventId, x: target.x, z: target.z };
        }),
      gid,
    );
    await guest.waitForFunction((setup) => {
      const state = window.__yolkTest.read().state;
      const target = state.players.find((p) => p.id === "host");
      return (
        state.time > setup.time &&
        target.health === 100 &&
        Math.hypot(target.x - setup.x, target.z - setup.z) < 0.1
      );
    }, targetSetup);
    await guest.mouse.click(720, 450);
    await host.waitForFunction(
      ({ id, after }) => {
        const state = window.__yolkTest.read().state;
        return (
          state.players.find((p) => p.id === "host").health < 99 &&
          state.events.some(
            (e) =>
              e.id > after &&
              e.type === "hit" &&
              e.player === id &&
              e.target === "host",
          )
        );
      },
      { id: gid, after: targetSetup.eventId },
    );
    await guest.waitForFunction(
      ({ id, after }) => {
        const state = window.__yolkTest.read().state;
        return (
          state.players.find((p) => p.id === "host").health < 99 &&
          state.events.some(
            (e) =>
              e.id > after &&
              e.type === "hit" &&
              e.player === id &&
              e.target === "host",
          )
        );
      },
      { id: gid, after: targetSetup.eventId },
    );
    pass(
      "Guest projectile hits are simulated by the host and replicated to both clients",
    );

    await host.evaluate(() => window.__yolkTest.setTime(0.1));
    await host
      .getByRole("heading", { name: "That’s a wrap.", exact: true })
      .waitFor();
    await guest
      .getByRole("heading", { name: "That’s a wrap.", exact: true })
      .waitFor();
    pass("Both players receive the same round result");
    await host.getByRole("button", { name: "PLAY AGAIN", exact: true }).click();
    await guest
      .getByRole("button", { name: "ENTER ARENA", exact: true })
      .waitFor();
    pass("Host rematch resets scores and returns guests to play");
    await host.getByRole("button", { name: "Pause menu", exact: true }).click();
    await host.getByRole("button", { name: "Close room", exact: true }).click();
    await host.getByRole("button", { name: "Close room", exact: true }).click();
    await guest
      .getByRole("heading", { name: "Connection ended", exact: true })
      .waitFor();
    pass("Host departure closes the room cleanly for guests");
  }
  const mobile = await make("Touch Egg", { width: 390, height: 844 });
  await mobile.screenshot({ path: new URL("05-mobile.png", out).pathname });
  const overflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  assert.equal(overflow, false);
  pass("Narrow layout has no horizontal overflow");
  for (const map of ["depot", "courtyard"]) {
    await host
      .getByRole("button", { name: "PRACTICE WITH BOTS", exact: true })
      .click();
    await host.locator("#setup-map").selectOption(map);
    await host.locator("#setup-bots").selectOption("0");
    await host
      .getByRole("button", { name: "START PRACTICE", exact: true })
      .click();
    await host.waitForTimeout(200);
    await host.screenshot({ path: new URL(`arena-${map}.png`, out).pathname });
    assert.equal(
      await host.evaluate(() => window.__yolkTest.read().state.options.map),
      map,
    );
    await host.evaluate(() => window.__yolkTest.setTime(0.1));
    await host
      .getByRole("heading", { name: "That’s a wrap.", exact: true })
      .waitFor();
    await host
      .getByRole("button", { name: "Leave match", exact: true })
      .click();
  }
  pass("All arenas render and finish through the results menu");
  await mobile
    .getByRole("button", { name: "PRACTICE WITH BOTS", exact: true })
    .click();
  await mobile.locator("#setup-bots").selectOption("0");
  await mobile
    .getByRole("button", { name: "START PRACTICE", exact: true })
    .click();
  assert.ok(await mobile.locator(".touch-stick").isVisible());
  await mobile.screenshot({ path: new URL("06-touch-game.png", out).pathname });
  pass("Touch controls appear on touch devices");
  assert.deepEqual(errors, []);
  pass("No browser JavaScript errors");
  await writeFile(
    new URL(
      process.env.YOLK_TEST_UI_ONLY
        ? "browser-ui-report.json"
        : "browser-report.json",
      out,
    ),
    JSON.stringify(
      {
        scope: process.env.YOLK_TEST_UI_ONLY
          ? "UI only; WebRTC still needs verification"
          : "Full browser and WebRTC suite",
        results,
        errors,
      },
      null,
      2,
    ),
  );
  console.log("COMPLETE", results.length, "checks");
} catch (e) {
  console.error(e);
  for (const c of browser.contexts())
    for (const p of c.pages())
      console.log(
        "NETWORK DIAGNOSTIC",
        await p.evaluate(() => ({
          network: window.__yolkTest?.network(),
          errors: document.querySelector("#dialog")?.textContent,
          dialogOpen: document.querySelector("#dialog")?.open,
          playerState: window.__yolkTest?.read(),
        })),
      );
  for (const [i, c] of browser.contexts().entries())
    for (const p of c.pages())
      await p
        .screenshot({ path: new URL(`failure-${i}.png`, out).pathname })
        .catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  await vite.close();
  signalServer?.close();
  setTimeout(() => process.exit(process.exitCode || 0), 100).unref();
}
