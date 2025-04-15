import { defineConfig } from "vitest/config";

export default defineConfig({
  server: { port: 5199 },
  test: {
    watch: false,

    workspace: [
      {
        test: {
          name: "Browser in workspace",
          browser: {
            provider: "playwright",
            enabled: true,
            headless: true,
            instances: [{ browser: "chromium" }]
          },
        },
      },
    ],
  },
});
