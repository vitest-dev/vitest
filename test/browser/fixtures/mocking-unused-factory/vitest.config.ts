import { appendFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'

const transformed = fileURLToPath(new URL('./node_modules/.vite/transformed.log', import.meta.url))

export default defineConfig({
  cacheDir: fileURLToPath(new URL('./node_modules/.vite', import.meta.url)),
  plugins: [
    {
      name: 'record-transform',
      transform(_code, id) {
        if (id.includes('guarded')) {
          appendFileSync(transformed, `${id}\n`)
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
