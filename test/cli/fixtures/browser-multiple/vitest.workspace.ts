import { resolve } from 'pathe';
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    cacheDir: resolve(import.meta.dirname, 'basic-1'),
    test: {
      name: 'basic-1',
      dir: import.meta.dirname,
      include: ['./basic.test.js'],
      browser: {
        enabled: true,
        name: 'chromium',
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
        name: 'chromium',
        provider: 'playwright',
        headless: true,
      }
    }
  },
])