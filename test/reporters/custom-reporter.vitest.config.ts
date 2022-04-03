import type { Reporter, Vitest } from 'vitest'
import { defineConfig } from 'vitest/config'

class TestReporter implements Reporter {
  ctx!: Vitest

  onInit(ctx: Vitest) {
    this.ctx = ctx
  }

  onFinished() {
    this.ctx.log('hello from custom reporter')
  }
}

export default defineConfig({
  test: {
    include: ['tests/reporters.spec.ts'],
    reporters: [new TestReporter()],
  },
})
