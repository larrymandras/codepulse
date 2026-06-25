import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // Prevent Vite pre-bundling the WASM module (RESEARCH Pitfall 7). The ort WASM
    // runtime itself is loaded from a pinned CDN at runtime (see wakeWordWorker.ts);
    // self-hosting it via vite-plugin-static-copy proved unreliable in dev and prod.
    exclude: ["onnxruntime-web"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
});
