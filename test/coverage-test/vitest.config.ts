import { resolve } from 'pathe'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

const provider = process.argv[1 + process.argv.indexOf('--provider')]

export default defineConfig({
  plugins: [
    vue(),
    {
      // Simulates Vite's virtual files: https://vitejs.dev/guide/api-plugin.html#virtual-modules-convention
      name: 'vitest-custom-virtual-files',
      resolveId(id) {
        if (id === 'virtual:vitest-custom-virtual-file-1')
          return 'src/virtual:vitest-custom-virtual-file-1.ts'

        if (id === '\0vitest-custom-virtual-file-2')
          return 'src/\0vitest-custom-virtual-file-2.ts'
      },
      load(id) {
        if (id === 'src/virtual:vitest-custom-virtual-file-1.ts') {
          return `
            const virtualFile = "This file should be excluded from coverage report #1"
            export default virtualFile;
          `
        }

        // Vitest browser resolves this as "\x00", Node as "__x00__"
        if (id === 'src/__x00__vitest-custom-virtual-file-2.ts' || id === 'src/\x00vitest-custom-virtual-file-2.ts') {
          return `
            const virtualFile = "This file should be excluded from coverage report #2"
            export default virtualFile;
          `
        }
      },
    },
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
