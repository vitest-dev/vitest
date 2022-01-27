/// <reference types="vitest" />

import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [{
    name: 'a-vitest-plugin-that-changes-config',
    config: () => ({
      test: { setupFiles: ['./setupFiles/add-something-to-global.ts'] },
    }),
  }],
  test: {
    globals: true,
    globalSetup: [
      './globalSetup/default-export.js',
      './globalSetup/named-exports.js',
      './globalSetup/ts-with-imports.ts',
      './globalSetup/another-vite-instance.ts',
    ],
  },
})
