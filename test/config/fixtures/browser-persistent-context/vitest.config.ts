import { playwright } from "@vitest/browser-playwright";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({
        persistentContext: path.join(import.meta.dirname, "./node_modules/.cache/test-user-data"),
      }),
      instances: [{ browser: "chromium" }],
    },
    fileParallelism: false,
  },
});
