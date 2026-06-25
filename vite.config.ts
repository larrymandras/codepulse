import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        {
          // onnxruntime-web 1.17+ ships each backend as a paired .wasm binary AND
          // a .mjs loader (e.g. ort-wasm-simd-threaded.jsep.mjs). BOTH must sit at
          // the server root that ort.env.wasm.wasmPaths ('/') points to, or the
          // backend fails with "no available backend found / Failed to fetch
          // dynamically imported module …jsep.mjs". Copying only *.wasm (the prior
          // config) broke live wake-word init — see Phase 92 VOX-01 QA.
          src: "node_modules/onnxruntime-web/dist/ort-wasm-*.{wasm,mjs}",
          dest: ".", // copies to dist/ root; matches wasmPaths = '/'
        },
      ],
    }),
  ],
  optimizeDeps: {
    exclude: ["onnxruntime-web"], // prevents Vite pre-bundling WASM module (RESEARCH Pitfall 7)
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
