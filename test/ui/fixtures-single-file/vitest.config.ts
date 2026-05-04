import { configDefaults, defineConfig } from 'vitest/config'

// pnpm -C test/ui test-fixtures --root fixtures-single-file --run
// pnpm dlx serve test/ui/fixtures-single-file/html/

export default defineConfig({
  test: {
    reporters: [
      ...configDefaults.reporters,
      ['html', { singleFile: true }],
    ],
  },
})
