import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { port: 5199 },
  test: {
    watch: false,
    browser: {
      provider: "playwright",
      name: "chromium",
      headless: true,
    },
  },
});
