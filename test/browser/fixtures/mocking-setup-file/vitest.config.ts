import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'

export default defineConfig({
  cacheDir: fileURLToPath(new URL('./node_modules/.vite', import.meta.url)),
  plugins: [
    {
      // registering the mock takes longer than importing the test file
      name: 'slow-mock-registration',
      enforce: 'pre',
      async resolveId(id, importer) {
        if (id === './source' && importer?.endsWith('browser-setup.ts')) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      },
    },
  ],
  test: {
    setupFiles: ['./browser-setup.ts'],
    browser: {
      enabled: true,
      provider,
      instances,
      headless: true,
    },
  },
})
