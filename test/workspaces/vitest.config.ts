import { defineConfig } from 'vitest/config'
import { cwdPlugin } from './cwdPlugin.js'

export default defineConfig({
  envPrefix: ['VITE_', 'CUSTOM_', 'ROOT_'],
  plugins: [cwdPlugin('ROOT')],
  test: {
    coverage: {
      enabled: true,
      provider: 'istanbul',
    },
    reporters: ['default', 'json'],
    outputFile: './results.json',
    globalSetup: './globalTest.ts',
    env: {
      CONFIG_VAR: 'root',
      CONFIG_OVERRIDE: 'root',
    },
    provide: {
      globalConfigValue: true,
    },
  },
})
