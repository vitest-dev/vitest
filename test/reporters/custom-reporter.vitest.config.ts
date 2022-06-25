import { defineConfig } from 'vitest/config'
import TestReporter from './src/custom-reporter'

export default defineConfig({
  test: {
    include: ['tests/reporters.spec.ts'],
    reporters: [new TestReporter()],
  },
})
