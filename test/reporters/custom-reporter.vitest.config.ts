import type { Reporter } from 'vitest'
import type { Vitest } from 'vitest/src/node'

import { defineConfig } from 'vite'

class TestReporter implements Reporter {
  ctx!: Vitest

  onInit(ctx) {
    this.ctx = ctx
  }

  onFinished() {
    this.ctx.log('hello from custom reporter')
  }
}

export default defineConfig({
  test: {
    include: ['tests/reporters.spec.ts'],
    reporters: ['default', new TestReporter()],
  },
})
