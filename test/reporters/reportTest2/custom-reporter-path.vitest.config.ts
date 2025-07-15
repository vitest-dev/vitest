import { resolve } from 'pathe'
import { defineConfig } from 'vitest/config'

const customReporter = resolve(import.meta.dirname, '../src/custom-reporter.ts')

export default defineConfig({
  root: import.meta.dirname,
  test: {
    root: import.meta.dirname,
    include: ['../tests/reporters.spec.ts'],
    reporters: [customReporter],
  },
})
