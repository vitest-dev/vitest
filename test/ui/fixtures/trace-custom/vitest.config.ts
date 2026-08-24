import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['basic.test.ts'],
    ui: true,
  },
})
