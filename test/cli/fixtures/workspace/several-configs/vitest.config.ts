import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      './test/*.config.*.ts',
    ],
  },
})