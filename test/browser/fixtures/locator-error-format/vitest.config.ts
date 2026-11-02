import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings.ts'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider,
      instances,
    },
  },
})
