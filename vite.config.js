import { defineConfig } from "vite";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

/* After the build, list dist/assets into sw.js so the worker precaches the whole
   shell (the file names carry hashes, so they are only known once built). */
function precacheAssets() {
  return {
    name: "vp-precache-assets",
    apply: "build",
    closeBundle() {
      const sw = "dist/sw.js";
      if (!existsSync(sw) || !existsSync("dist/assets")) return;
      const files = readdirSync("dist/assets").filter((f) => /\.(js|css)$/.test(f)).map((f) => JSON.stringify("/assets/" + f));
      const src = readFileSync(sw, "utf8");
      if (!src.includes("/* __BUILD_ASSETS__ */")) return;
      writeFileSync(sw, src.replace("/* __BUILD_ASSETS__ */", files.length ? ", " + files.join(", ") : ""));
    }
  };
}

/* Vita Plena — Vite config.
   The app is plain ES modules with no framework, so this is deliberately small.
   `index.html` at the repo root is the entry; everything it references lives in `src/`.
   Netlify runs `npm run build` and publishes `dist/` (see netlify.toml). */
export default defineConfig({
  plugins: [precacheAssets()],
  // A build stamp the app can show, so "am I looking at the new version?" is
  // answerable at a glance instead of by guessing at URLs and caches.
  define: {
    __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC")
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "es2020",
    rollupOptions: {
      output: {
        // Firebase is ~600 KB and changes rarely; keep it out of the app chunk so the
        // app shell stays small and cacheable (matters once the service worker lands).
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth", "firebase/firestore"]
        }
      }
    }
  },
  server: {
    port: 5173,
    // Local dev hits the deployed function, so the companion works without `netlify dev`.
    proxy: {
      "/.netlify/functions": {
        target: "https://vitaplena13.netlify.app",
        changeOrigin: true
      }
    }
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.js"]
  }
});
