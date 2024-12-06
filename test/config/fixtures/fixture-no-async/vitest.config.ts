import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    supported: {
      "async-await": false,
    },
  },
});
