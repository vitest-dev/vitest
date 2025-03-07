import { defineConfig } from "vitest/config"
import "@vitest/test-dep-linked/ts";

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      instances: [
        {
          browser: 'chromium',
        }
      ]
    }
  }
})
