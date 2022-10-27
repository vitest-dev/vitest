import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    typecheck: {
      allowJs: true,
      include: ['**/*.test-d.*'],
    },
  },
})
