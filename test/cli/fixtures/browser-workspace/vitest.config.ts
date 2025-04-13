import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    workspace: [
      {
        test: {
          name: "browser",
          browser: {
            enabled: true,
            headless: true,
            instances: [{ browser: "chromium" }],

            // This will be overridden with CLI options
            provider: "non-existing-provider",
            isolate: true,
          },
        },
      },
    ],
  },
});
