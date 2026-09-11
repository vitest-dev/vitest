import { defineConfig } from 'vitest/config'

// pnpm -C test/e2e/typecheck exec vitest -c vitest.config.fails.ts
export default defineConfig({
  test: {
    dir: './failing',
    typecheck: {
      enabled: true,
      allowJs: true,
      include: ['**/*.test-d.*'],
      tsconfig: './tsconfig.fails.json',
    },
  },
})
