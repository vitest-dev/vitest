import { resolve } from "pathe";
import { defineConfig } from "vite";

import nodePolyfills from "rollup-plugin-node-polyfills";

const nodeConfig = nodePolyfills({ fs: true, crypto: true });

export default defineConfig({
  server: {
    watch: { ignored: ["**/**"] },
  },
  resolve: {
    alias: {
      "@vitest/ws-client": `${resolve(__dirname, "../ws-client/src/index.ts")}`,
      vitest: `vitest/web`,
    },
  },
  plugins: [
    {
      enforce: "pre",
      name: "@vitest/web",
      resolveId(id, importer) {
        id = normalizeId(id);
        if (id === "tty") {
          return nodeConfig.resolveId(normalizeId(id), importer!);
        }
        if (id === "crypto") {
          return nodeConfig.resolveId(normalizeId(id), importer!);
        }
        if (id === "path") {
          return nodeConfig.resolveId(normalizeId(id), importer!);
        }
        return null;
      },
      load(id) {
        if (normalizeId(id) === "module") {
          return `export const createRequire = () => {}`;
        }
        if (normalizeId(id) === "perf_hooks") {
          return `export const performance = globalThis.performance`;
        }
        return null;
      },
    },
  ],
  build: {
    outDir: "./dist/client",
  },
});

function normalizeId(id: string, base?: string): string {
  if (base && id.startsWith(base)) id = `/${id.slice(base.length)}`;

  return id
    .replace(/^\/@id\/__x00__/, "\0") // virtual modules start with `\0`
    .replace(/^\/@id\//, "")
    .replace(/^__vite-browser-external:/, "")
    .replace(/^node:/, "")
    .replace(/[?&]v=\w+/, "?") // remove ?v= query
    .replace(/\?$/, ""); // remove end query mark
}
