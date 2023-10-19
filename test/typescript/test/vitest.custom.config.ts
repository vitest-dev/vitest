import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    typecheck: {
      enabled: true,
      allowJs: true,
      include: ['**/*.test-d.*'],
      tsconfig: '../tsconfig.custom.json',
    },
  },
})
