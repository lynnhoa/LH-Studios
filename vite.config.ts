// @ts-nocheck — build config (Node), not part of the app bundle
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, existsSync } from "fs";
import { resolve } from "path";

// The repo is flat (no public/ folder), so these files are copied
// into the build by hand: service worker, icons, manifest, robots.
const ROOT_STATIC = [
  "sw.js", "site.webmanifest", "robots.txt",
  "icon-192.png", "icon-512.png", "apple-touch-icon.png",
  "favicon.ico", "favicon-16x16.png", "favicon-32x32.png",
];

export default defineConfig({
  plugins: [
    react(),
    {
      name: "copy-root-static",
      apply: "build",
      closeBundle() {
        const root = process.cwd();
        for (const f of ROOT_STATIC) {
          const src = resolve(root, f);
          if (existsSync(src)) copyFileSync(src, resolve(root, "dist", f));
        }
      },
    },
  ],
  build: {
    outDir:      "dist",
    emptyOutDir: true,
    // Raise chunk size warning threshold — html2canvas + jsPDF are large
    chunkSizeWarningLimit: 1600,
  },
  // Allow dynamic imports for html2canvas + jsPDF (lazy-loaded in PDFModal/PDFExport)
  optimizeDeps: {
    include: ["html2canvas", "jspdf"],
  },
});
