import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    browser: {
      headless: true,
    } as any, // testing that instances is required
  },
})