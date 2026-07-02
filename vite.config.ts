import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
