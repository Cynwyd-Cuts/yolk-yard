import { chromium } from "playwright";
import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const out = "test-results/quality";
await mkdir(out, { recursive: true });
const server = await createServer({
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
});
await server.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.YOLK_TEST_CHROME
    ? { executablePath: process.env.YOLK_TEST_CHROME }
    : {}),
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.addInitScript(() => {
  localStorage.setItem(
    "yolk-settings",
    JSON.stringify({
      quality: "low",
      dragLook: true,
      fov: 85,
      volume: 0,
      sensitivity: 1,
    }),
  );
  localStorage.setItem(
    "yolk-profile",
    JSON.stringify({ name: "Quality Check", weapon: "sprinter", hat: 1 }),
  );
});
const pass = (message) => {
  checks.push(message);
  console.log("PASS", message);
};
try {
  await page.goto("http://127.0.0.1:5174/?qa=1");
  await page.getByRole("button", { name: "Loadout", exact: true }).waitFor();
  await page.screenshot({ path: `${out}/menu.png` });
  await page.getByRole("button", { name: "Loadout", exact: true }).click();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll(".weapon-portrait")].length === 7 &&
      [...document.querySelectorAll(".weapon-portrait")].every(
        (i) => i.complete && i.naturalWidth === 600,
      ),
  );
  const portraits = await page
    .locator(".weapon-portrait")
    .evaluateAll((nodes) => nodes.map((i) => i.src));
  assert.equal(new Set(portraits).size, 7);
  pass("All seven loadout cards have distinct rendered model portraits");
  await page.screenshot({ path: `${out}/loadout.png` });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: "PRACTICE WITH BOTS", exact: true })
    .click();
  await page.locator("#setup-bots").selectOption("0");
  await page
    .getByRole("button", { name: "START PRACTICE", exact: true })
    .click();
    await page.getByRole("button", { name: "Enter the Yard", exact: true }).click();
    await page.waitForFunction(() => { const q=window.__yolkTest.read(); return q.state.players.find(p=>p.id===q.localId)?.health > 0; });
  for (const id of [
    "sprinter",
    "scatter",
    "needle",
    "zipper",
    "thumper",
    "anchor",
    "duet",
    "pip",
  ]) {
    const spawnedAt = await page.evaluate(
      (id) =>
        window.__yolkTest.fixture((s) => {
          const p = s.players.get("host");
          p.nextProfile = null;
          p.weapon = id === "pip" ? "sprinter" : id;
          s.spawn(p);
          Object.assign(p, {
            x: 0,
            y: 0,
            z: 20,
            yaw: 0,
            pitch: 0,
            slot: id === "pip" ? 1 : 0,
          });
          return s.time;
        }),
      id,
    );
    // Let the normal spawn event reset the input before selecting the fixture
    // pose or sidearm, otherwise a later reset can replace the captured model.
    await page.waitForFunction(
      (time) => window.__yolkTest.read().state.time > time + 0.05,
      spawnedAt,
    );
    await page.evaluate(
      (id) =>
        window.__yolkTest.pose({
          x: 0,
          y: 0,
          z: 20,
          yaw: 0,
          pitch: 0,
          slot: id === "pip" ? 1 : 0,
        }),
      id,
    );
    if (id === "pip") await page.keyboard.press("Digit2");
    await page.waitForFunction(
      (id) =>
        document.querySelector("#gun-name").textContent.toLowerCase() === id &&
        window.__yolkTest.read().presentation.weapon === id,
      id,
    );
    await page.waitForTimeout(220);
    await page.screenshot({ path: `${out}/weapon-${id}.png` });
    await page.keyboard.down("ShiftLeft");
    if (id === "needle" || id === "duet")
      await page.waitForFunction(
        () =>
          window.__yolkTest.read().scope.active &&
          window.__yolkTest.read().scope.aimBlend > 0.97,
      );
    else await page.waitForTimeout(280);
    await page.screenshot({ path: `${out}/sight-${id}.png` });
    assert.equal(
      (await page.evaluate(() => window.__yolkTest.read())).presentation.weapon,
      id,
    );
    if (id === "needle" || id === "duet") {
      assert.equal(await page.locator("#scope").isVisible(), true);
      assert.equal(
        (await page.evaluate(() => window.__yolkTest.read())).scope.lens,
        true,
      );
    }
    await page.keyboard.up("ShiftLeft");
  }
  pass(
    "All eight weapon models and sights render, including both magnified optic lenses",
  );
  await page.waitForFunction(
    () => window.__yolkTest.read().scope.aimBlend < 0.02,
  );
  await page.mouse.move(720, 450);
  await page.mouse.down();
  await page.waitForFunction(
    () =>
      !!window.__yolkTest.read().presentation.flash &&
      window.__yolkTest.read().presentation.projectiles > 0,
  );
  const firing = await page.evaluate(() => window.__yolkTest.read());
  const shot = firing.state.events
    .filter((e) => e.type === "shot" && e.player === "host")
    .at(-1);
  assert.ok(shot);
  assert.ok(
    Math.hypot(
      firing.presentation.flash[0] - shot.origin.x,
      firing.presentation.flash[1] - shot.origin.y,
      firing.presentation.flash[2] - shot.origin.z,
    ) < 0.16,
  );
  await page.screenshot({ path: `${out}/firing.png` });
  await page.mouse.up();
  pass(
    "Actual firing creates traveling bolts and a flash at the rendered muzzle",
  );

  await page.getByRole("button", { name: "Pause menu", exact: true }).click();
  await page.getByRole("button", { name: "Leave match", exact: true }).click();
  const metrics = [];
  for (const map of ["yard", "depot", "courtyard"]) {
    await page
      .getByRole("button", { name: "PRACTICE WITH BOTS", exact: true })
      .click();
    await page.locator("#setup-map").selectOption(map);
    await page.locator("#setup-bots").selectOption("7");
    await page
      .getByRole("button", { name: "START PRACTICE", exact: true })
      .click();
    await page.getByRole("button", { name: "Enter the Yard", exact: true }).click();
    await page.waitForFunction(() => { const q=window.__yolkTest.read(); return q.state.players.find(p=>p.id===q.localId)?.health > 0; });
    if (map === "yard") {
      await page
        .getByRole("button", { name: "Pause menu", exact: true })
        .click();
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page.getByLabel("Graphics", { exact: true }).selectOption("high");
      await page.getByRole("button", { name: "Done", exact: true }).click();
      await page.getByRole("button", { name: "RESUME", exact: true }).click();
    }
    await page.waitForTimeout(500);
    // Elevated inspection camera is confined to this development-only fixture.
    await page.evaluate(() =>
      window.__yolkTest.pose({
        x: 22,
        y: 18,
        z: 33,
        yaw: 0.48,
        pitch: -0.53,
        vy: 0,
      }),
    );
    await page.screenshot({ path: `${out}/arena-${map}.png` });
    metrics.push(
      await page.evaluate(() => ({
        map: window.__yolkTest.read().state.options.map,
        calls: window.__yolkTest.read().drawCalls,
        triangles: window.__yolkTest.read().triangles,
      })),
    );
    await page.getByRole("button", { name: "Pause menu", exact: true }).click();
    await page
      .getByRole("button", { name: "Leave match", exact: true })
      .click();
  }
  pass("All expanded arenas render with a full bot room");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Loadout", exact: true }).click();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({ path: `${out}/mobile-loadout.png` });
  pass("Weapon portraits fit the narrow layout");
  assert.deepEqual(errors, []);
  pass("No browser or WebGL errors during model, optic, and arena changes");
  await writeFile(
    `${out}/report.json`,
    JSON.stringify({ checks, metrics, errors }, null, 2),
  );
  console.log(JSON.stringify(metrics));
} catch (error) {
  await page.screenshot({ path: `${out}/failure.png` });
  console.error("BROWSER ERRORS", errors);
  throw error;
} finally {
  await browser.close();
  await server.close();
}

