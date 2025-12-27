import { resolve } from 'pathe'
import { defineConfig } from 'vitest/config'

const customReporter = resolve(import.meta.dirname, './src/custom-reporter.ts')

export default defineConfig({
  test: {
    include: ['tests/reporters.spec.ts'],
    reporters: [customReporter],
  },
})
