import { defineConfig } from "vitest/config";
import { provider } from '../../settings'

export default defineConfig({
  server: { port: 5199 },
  test: {
    watch: false,

    projects: [
      {
        test: {
          name: "Browser in workspace",
          browser: {
            provider,
            enabled: true,
            headless: true,
            instances: [
              { browser: provider.name === 'webdriverio' ? "chrome" : "chromium" },
            ],
          },
        },
      },
    ],
  },
});
