import { resolve } from 'pathe'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import MagicString from 'magic-string'
import remapping from '@ampproject/remapping'

const provider = process.argv[1 + process.argv.indexOf('--provider')]

export default defineConfig({
  plugins: [
    vue(),
    /*
     * Transforms `multi-environment.ts` differently based on test environment (JSDOM/Node)
     * so that there are multiple different source maps for a single file.
     * This causes a case where coverage report is incorrect if sourcemaps are not picked based on transform mode.
     */
    {
      name: 'vitest-custom-multi-transform',
      enforce: 'pre',
      transform(code, id, options) {
        if (id.includes('src/multi-environment')) {
          const ssr = options?.ssr || false
          const transforMode = `transformMode is ${ssr ? 'ssr' : 'csr'}`
          const padding = '\n*****'.repeat(ssr ? 0 : 15)

          const transformed = new MagicString(code)
          transformed.replace('\'default-padding\'', `\`${transforMode} ${padding}\``)

          const map = remapping(
            [transformed.generateMap({ hires: true }), this.getCombinedSourcemap() as any],
            () => null,
          ) as any

          return { code: transformed.toString(), map }
        }
      },
    },
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
      reportOnFailure: true,
      reporter: [
        'text',
        ['html'],
        ['lcov', {}],
        ['json', { file: 'custom-json-report-name.json' }],
      ],

      // These will be updated by tests and reseted back by generic.report.test.ts
      thresholds: {
        'autoUpdate': true,
        'functions': 0,
        'branches': 1.01,
        'lines': 0,
        'statements': 1.01,

        // These need to pass both V8 and istanbul
        '**/function-count.ts': {
          statements: 50,
          branches: 99,
          functions: 59,
          lines: 50,
        },
      },
    },
    setupFiles: [
      resolve(__dirname, './setup.ts'),
      './src/another-setup.ts',
    ],
  },
})
