import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { instances, provider } from '../../settings'
import { stripVTControlCharacters } from 'node:util'

export default defineConfig({
  cacheDir: fileURLToPath(new URL("./node_modules/.vite", import.meta.url)),
  test: {
    browser: {
      enabled: true,
      provider,
      instances,
      commands: {
        stripVTControlCharacters(_, text) {
          return stripVTControlCharacters(text)
        }
      }
    },
  },
})