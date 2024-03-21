import { defineConfig } from 'vitest/config'
import { BaseReporter } from '../../../../packages/vitest/src/node/reporters/base'

class MyReporter extends BaseReporter {
  onInit(): void {}
  async onFinished() {}
}

export default defineConfig({
  test: {
    reporters: new MyReporter()
  }
})
