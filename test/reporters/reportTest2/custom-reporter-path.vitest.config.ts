import { resolve } from 'pathe'
import { defineConfig } from 'vitest/config'

const customReporter = resolve(__dirname, '../src/custom-reporter.ts')

export default defineConfig({
  root: __dirname,
  test: {
    root: __dirname,
    include: ['../tests/reporters.spec.ts'],
    reporters: [customReporter],
  },
})
