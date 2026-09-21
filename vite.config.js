import { defineConfig } from "vite";
import { RELEASE } from "./src/releases.js";
const build = process.env.GITHUB_SHA || `local-${Date.now()}`;
const version = JSON.stringify({ build, release: RELEASE });
export default defineConfig({
  base: "./",
  define: { __BUILD_ID__: JSON.stringify(build) },
  plugins: [{
    name: "yolk-build-version",
    configureServer(server) {
      server.middlewares.use("/version.json", (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(version);
      });
    },
    generateBundle() { this.emitFile({ type: "asset", fileName: "version.json", source: version }); },
  }],
  build: { target: "es2020", chunkSizeWarningLimit: 750 },
});
