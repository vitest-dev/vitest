import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    dir: './test',
    env: {
      // force tty output
      CI: 'false',
    },
  },
})
