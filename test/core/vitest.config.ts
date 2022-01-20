import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    {
      name: 'example',
      resolveId(source) {
        if (source === 'virtual-module')
          return source
      },
      load(id) {
        if (id === 'virtual-module') {
          return `
            export const value = 'original';
          `
        }
      },
    },
  ],
  test: {
    testTimeout: 2000,
    // threads: false,
    setupFiles: [
      './test/setup.ts',
    ],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
})
