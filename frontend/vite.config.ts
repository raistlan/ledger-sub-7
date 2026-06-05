import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // Inline the backend's public origin at build time so the browser-driven wake
  // (useWakeBackend → clientEnv) can reach the backend cross-origin. Reuses the
  // BACKEND_URL the frontend service already has; no separate VITE_ var needed.
  define: {
    __BACKEND_URL__: JSON.stringify(process.env.BACKEND_URL ?? ""),
  },
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
