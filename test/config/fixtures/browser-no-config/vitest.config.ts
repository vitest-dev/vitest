import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    browser: {
      headless: true,
      // testing that instances is required
    },
  },
})