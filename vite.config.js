import { defineConfig } from "vite";
export default defineConfig({
  server: { proxy: { "/api": "http://localhost:3000", "/session": { target: "ws://localhost:3000", ws: true } } },
  base: "./",
  build: { target: "es2022", chunkSizeWarningLimit: 750 },
});
