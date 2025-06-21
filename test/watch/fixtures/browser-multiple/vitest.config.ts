import { resolve } from 'pathe';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        cacheDir: resolve(import.meta.dirname, 'basic-1'),
        test: {
          name: 'basic-1',
          dir: import.meta.dirname,
          include: ['./basic.test.js'],
          browser: {
            enabled: true,
            instances: [{ browser: 'chromium' }],
            provider: 'playwright',
            headless: true,
          }
        }
      },
      {
        cacheDir: resolve(import.meta.dirname, 'basic-2'),
        test: {
          name: 'basic-2',
          dir: import.meta.dirname,
          include: ['./basic.test.js'],
          browser: {
            enabled: true,
            instances: [{ browser: 'chromium' }],
            provider: 'playwright',
            headless: true,
          }
        }
      },
    ],
  },
})