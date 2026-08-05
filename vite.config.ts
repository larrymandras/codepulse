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
    // Emits dist/chunk-composition.json with per-chunk module attribution
    // (DEBT-03 chunk-size investigation). Opt-in only — a normal `npm run
    // build` never runs this plugin's hook, so the emitted asset set is
    // byte-for-byte unchanged. Reproduce with:
    //   ANALYZE_BUNDLE=1 npm run build
    // then read dist/chunk-composition.json.
    process.env.ANALYZE_BUNDLE === "1" && {
      name: "chunk-composition-report",
      generateBundle(_options, bundle) {
        const chunks: Array<{
          fileName: string;
          renderedBytes: number;
          isEntry: boolean;
          isDynamicEntry: boolean;
          modules: Array<{ id: string; renderedLength: number }>;
          otherModulesCount: number;
          otherModulesBytes: number;
        }> = [];

        for (const asset of Object.values(bundle)) {
          if (asset.type !== "chunk") continue;

          const allModules = Object.entries(asset.modules)
            .map(([id, mod]) => ({ id, renderedLength: mod.renderedLength }))
            .sort((a, b) => b.renderedLength - a.renderedLength);

          const topModules = allModules.slice(0, 30);
          const restModules = allModules.slice(30);

          chunks.push({
            fileName: asset.fileName,
            renderedBytes: asset.code.length,
            isEntry: asset.isEntry,
            isDynamicEntry: asset.isDynamicEntry,
            modules: topModules,
            otherModulesCount: restModules.length,
            otherModulesBytes: restModules.reduce(
              (sum, m) => sum + m.renderedLength,
              0,
            ),
          });
        }

        chunks.sort((a, b) => b.renderedBytes - a.renderedBytes);

        this.emitFile({
          type: "asset",
          fileName: "chunk-composition.json",
          source: JSON.stringify({ chunks }, null, 2),
        });
      },
    },
  ].filter(Boolean),
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
    // Explicit wide bind so the tailnet interface stays reachable across
    // restarts (106-05, Tailscale laptop checklist) -- verified live via
    // `curl http://<tailnet-ip>:5173/` returning 200 from the office PC.
    host: true,
    // `host: true` alone is not enough: Vite's DNS-rebinding guard rejects any
    // request whose Host header is a name it doesn't recognise, so reaching the
    // dev server over MagicDNS returned 403 "Blocked request" while the raw
    // tailnet IP returned 200 (106-05, verified live). Allow only this machine's
    // own tailnet name -- IP literals and localhost stay allowed by default, and
    // no other host is granted access.
    allowedHosts: ["lmofficenew.tail5bb6b3.ts.net"],
  },
});
