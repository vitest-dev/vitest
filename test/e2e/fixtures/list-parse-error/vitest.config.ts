import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['broken.test.ts', 'ok.test.ts'],
  },
})
