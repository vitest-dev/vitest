import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/reporters.spec.ts'],
    reporters: ['pkg-reporter', 'vitest-sonar-reporter'],
    outputFile: './sonar-config.xml',
  },
})
