import { defineConfig } from "vite";

/* Vita Plena — Vite config.
   The app is plain ES modules with no framework, so this is deliberately small.
   `index.html` at the repo root is the entry; everything it references lives in `src/`.
   Netlify runs `npm run build` and publishes `dist/` (see netlify.toml). */
export default defineConfig({
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
