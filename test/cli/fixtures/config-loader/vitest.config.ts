import { defineConfig } from "vitest/config"
import "@test/test-dep-linked/ts";

export default defineConfig({
  test: {
    projects: [
      "browser/vitest.config.ts",
      "node/vitest.config.ts",
    ],
  },
})
