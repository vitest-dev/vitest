import { provider } from '../../settings.ts'
import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { port: 5199 },
  test: {
    watch: false,
    browser: {
      enabled: true,
      provider,
      instances: [
        { browser: "chromium" },
      ],
      headless: true,
    },
  },
});
