import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";

const url = process.env.GAME_URL;
if (!url?.startsWith("https://"))
  throw new Error("GAME_URL must be the deployed HTTPS site.");
await mkdir("test-results/live", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
  ],
});
const errors = [];
async function player(name) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Graphics", { exact: true }).selectOption("low");
  await page
    .getByLabel("Drag to look (no mouse lock)", { exact: true })
    .check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("textbox", { name: "YOUR NAME", exact: true })
    .fill(name);
  return page;
}
try {
  const host = await player("Live Host");
  await host.screenshot({ path: "test-results/live/menu.png" });
  await host.getByRole("button", { name: /PLAY WITH FRIENDS/ }).click();
  await host.locator("#setup-bots").selectOption("0");
  await host.getByRole("button", { name: "CREATE ROOM", exact: true }).click();
  await host.locator(".room-code").waitFor({ timeout: 25000 });
  const code = (await host.locator(".room-code").innerText()).trim();
  assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  console.log(
    "PASS Deployed game renders and creates a room through public signaling",
  );
  const guest = await player("Live Guest");
  await guest.getByRole("button", { name: "Join a room", exact: true }).click();
  await guest.locator("#join-code").fill(code);
  await guest.getByRole("button", { name: "JOIN ROOM", exact: true }).click();
  await guest.locator(".room-code").waitFor({ timeout: 30000 });
  await host.getByText("Live Guest", { exact: true }).waitFor();
  console.log(
    "PASS Public room connects two production clients through WebRTC",
  );
  await host.getByRole("button", { name: "START MATCH", exact: true }).click();
    await host.getByRole("button", { name: "Enter the Yard", exact: true }).click();
    await host.waitForFunction(() => document.querySelector("#health").textContent === "100");
  await guest.getByRole("button", { name: "Enter the Yard", exact: true }).click();
  await guest.getByRole("button", { name: "Scoreboard", exact: true }).click();
  await guest
    .locator("#scoreboard")
    .getByText("Live Host", { exact: true })
    .waitFor();
  assert.match(await guest.locator("#scoreboard").innerText(), /Live Host/);
  assert.match(await guest.locator("#scoreboard").innerText(), /Live Guest/);
  await guest.getByRole("button", { name: "Scoreboard", exact: true }).click();
  await guest.screenshot({ path: "test-results/live/multiplayer.png" });
  console.log(
    "PASS Published match starts with both players in its scoreboard",
  );
  await host.getByRole("button", { name: "Pause menu", exact: true }).click();
  await host.getByRole("button", { name: "Close room", exact: true }).click();
  await host.getByRole("button", { name: "Close room", exact: true }).click();
  await guest
    .getByRole("heading", { name: "Connection ended", exact: true })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log("PASS Production room closes cleanly with no JavaScript errors");
} catch (error) {
  for (const [i, context] of browser.contexts().entries()) {
    for (const page of context.pages()) {
      console.error("LIVE PAGE", await page.locator("body").innerText());
      await page
        .screenshot({ path: `test-results/live/failure-${i}.png` })
        .catch(() => {});
    }
  }
  throw error;
} finally {
  await browser.close();
}

