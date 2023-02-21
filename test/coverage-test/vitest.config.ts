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
    },
    setupFiles: [
      resolve(__dirname, './setup.ts'),
      './src/another-setup.ts',
    ],
  },
})
