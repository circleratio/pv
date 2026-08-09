import { defineConfig } from "vite";

// https://tauri.app/develop/#vite
export default defineConfig({
  root: "src",
  publicDir: "assets",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  test: {
    root: ".",
    environment: "jsdom",
    include: ["tests/**/*.test.js"],
    passWithNoTests: true,
    setupFiles: ["vitest-canvas-mock"],
  },
});
