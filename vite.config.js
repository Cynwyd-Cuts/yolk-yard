import { defineConfig } from "vite";
import { RELEASE_NOTES } from "./src/releases.js";
import { nextReleaseHistory } from "./src/release-history.js";
export default defineConfig(async ({ command }) => {
  const build = process.env.GITHUB_SHA || `local-${Date.now()}`;
  let previous;
  if (command === "build" && process.env.GITHUB_REPOSITORY) {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
    const response = await fetch(`https://${owner.toLowerCase()}.github.io/${repo}/release-history.json?t=${Date.now()}`, { signal: AbortSignal.timeout(20000), cache: "no-store" });
    if (response.ok) previous = await response.json();
    else if (response.status !== 404) throw new Error(`Cannot read published release history: ${response.status}`);
  }
  const history = nextReleaseHistory(build, RELEASE_NOTES, previous);
  const version = JSON.stringify({ build, release: history.releases[0].number });
  return {
    base: "./",
    define: { __BUILD_ID__: JSON.stringify(build), __RELEASE_HISTORY__: JSON.stringify(history.releases) },
    plugins: [{
      name: "yolk-build-version",
      transformIndexHtml(html) { return command === "serve" ? html.replace("https://0.peerjs.com wss://0.peerjs.com", "https://0.peerjs.com wss://0.peerjs.com http://127.0.0.1:9000 ws://127.0.0.1:9000") : html; },
      configureServer(server) {
        server.middlewares.use("/version.json", (_req, res) => {
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(version);
        });
      },
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "version.json", source: version });
        this.emitFile({ type: "asset", fileName: "release-history.json", source: JSON.stringify(history) });
      },
    }],
    build: { target: "es2022", chunkSizeWarningLimit: 750 },
  };
});
