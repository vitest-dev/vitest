import { provider } from '../../settings'
import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { port: 5199 },
  test: {
    watch: false,
    browser: {
      enabled: true,
      provider,
      instances: [
        { browser: provider.name === 'webdriverio' ? "chrome" : "chromium" },
      ],
      headless: true,
    },
  },
});
