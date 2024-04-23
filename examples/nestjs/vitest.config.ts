import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        target: 'esnext',
        parser: {
          syntax: 'typescript',
          decorators: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
      },
    }),
  ],
  test: {
    coverage: {
      enabled: true,
      provider: 'v8',
      thresholds: {
        branches: 100,
        functions: 57.14,
        lines: 81.08,
        statements: 81.08,
      },
    },
  },
})
