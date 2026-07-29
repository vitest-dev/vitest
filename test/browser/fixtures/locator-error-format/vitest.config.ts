import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider,
      instances,
    },
  },
})
