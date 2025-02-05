import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    {
      name: 'vitest:break',
      load(id) {
        throw new Error(`should not load any files, loaded ${id} anyway`)
      }
    }
  ],
  test: {
    setupFiles: ['./setup.ts'],
    globalSetup: './globalSetup.ts',
    experimental: {
      nativeImport: true,
    },
  },
})
