/// <reference types="vitest/config" />

import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: playwright() as any,
      instances: [{ browser: "chromium" }],
    },
  },
});
