import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      // The ort WASM runtime is loaded from a pinned CDN at runtime (see
      // wakeWordWorker.ts: ort.env.wasm.wasmPaths). But Vite's asset pipeline still
      // emits a content-hashed copy (~26 MB) from onnxruntime-web's internal
      // `new URL('…wasm', import.meta.url)` reference, which is never fetched. Drop
      // those dead assets from the build so dist/ isn't bloated by tens of MB.
      name: "drop-unused-ort-wasm",
      generateBundle(_options, bundle) {
        for (const fileName of Object.keys(bundle)) {
          if (/ort-wasm.*\.wasm$/.test(fileName)) {
            delete bundle[fileName];
          }
        }
      },
    },
  ],
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
