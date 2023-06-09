import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    typecheck: {
      include: ['**/fail.test-d.ts'],
      tsconfig: '../tsconfig.empty.json',
    },
  },
})
