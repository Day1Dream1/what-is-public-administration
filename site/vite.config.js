import { defineConfig } from "vite";

// Relative base so the built site works at any path (e.g. https://<user>.github.io/<repo>/).
export default defineConfig({
  base: "./",
  build: { outDir: "dist", assetsDir: "assets", chunkSizeWarningLimit: 900 },
});
