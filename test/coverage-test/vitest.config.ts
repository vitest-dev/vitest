import { resolve } from 'pathe'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

const provider = process.argv[1 + process.argv.indexOf('--provider')]

export default defineConfig({
  plugins: [
    vue(),
  ],
  define: {
    MY_CONSTANT: '"my constant"',
  },
  test: {
    watch: false,
    coverage: {
      provider: provider as any,
      customProviderModule: provider === 'custom' ? 'custom-provider' : undefined,
      include: ['src/**'],
      clean: true,
      all: true,
      reporter: [
        'text',
        ['html'],
        ['lcov', {}],
        ['json', { file: 'custom-json-report-name.json' }],
      ],

      // These will be updated by tests and reseted back by generic.report.test.ts
      thresholdAutoUpdate: true,
      functions: 1.01,
      branches: 1.01,
      lines: 1.01,
      statements: 1.01,
    },
    setupFiles: [
      resolve(__dirname, './setup.ts'),
      './src/another-setup.ts',
    ],
  },
})
