import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'

// Test that server options defined in an inline project config
// are passed through to the browser Vite server.
export default defineConfig({
  cacheDir: fileURLToPath(new URL('./node_modules/.vite', import.meta.url)),
  test: {
    projects: [
      {
        server: {
          headers: {
            'x-inline-project': 'from-inline-config',
          },
        },
        test: {
          browser: {
            enabled: true,
            headless: true,
            provider,
            instances,
          },
        },
      },
    ],
  },
})
