import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'

export default defineConfig({
  cacheDir: fileURLToPath(new URL('./node_modules/.vite', import.meta.url)),
  test: {
    projects: [
      {
        test: {
          name: 'tester',
          setupFiles: ['./setup.ts'],
          browser: {
            enabled: true,
            provider,
            instances,
          },
        },
      },
    ],
  },
})
