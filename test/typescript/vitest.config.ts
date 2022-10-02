import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    typecheck: {
      checker: 'vue-tsc',
      // include: [
      //   // '**/*.test-d.ts',
      //   // '**/*.test-d.js',
      // ],
      allowJs: true,
    },
  },
})
