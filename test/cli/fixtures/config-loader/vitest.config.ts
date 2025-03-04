import { defineConfig } from "vitest/config"
import "@vitest/test-dep-linked/ts";

export default defineConfig({
  test: {
    workspace: [
      "browser/vitest.config.ts",
      "node/vitest.config.ts",
    ],
  },
})
