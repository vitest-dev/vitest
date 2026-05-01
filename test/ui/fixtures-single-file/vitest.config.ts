import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    reporters: [
      ...configDefaults.reporters,
      ['html', { singleFile: true }],
    ],
  },
})
