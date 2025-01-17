import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { basename, dirname, join, resolve } from 'pathe'
import { defaultExclude, defineConfig } from 'vitest/config'

const require = createRequire(import.meta.url)
const tsxApi = require.resolve('tsx/esm/api')

export default defineConfig({
  plugins: [
    {
      name: 'example',
      resolveId(source) {
        if (source === 'virtual-module') {
          return source
        }
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
  define: {
    'process': {},
    'global': {},
    'import.meta.env.TEST_NAME': '"hello world"',
    'process.env.HELLO_PROCESS': '"hello process"',
    // can reassign
    '__DEFINE__': '"defined"',
    '__JSON__': JSON.stringify({ hello: 'world' }),
    // edge cases
    // should not be available for reassigning as __MODE__ = 'test2'
    // but can reassign with process.env.MODE = 'test2'
    '__MODE__': 'process.env.MODE',
    'SOME.VARIABLE': '"variable"',
    'SOME.SOME.VARIABLE': '"nested variable"',
    '__UNDEFINED__': undefined,
    '__NULL__': null,
    '__ZERO__': 0,
    '__FALSE__': false,
    'import.meta.vitest': false,
  },
  resolve: {
    alias: [
      { find: '#', replacement: resolve(__dirname, 'src') },
      { find: /^custom-lib$/, replacement: resolve(__dirname, 'projects', 'custom-lib') },
      { find: /^inline-lib$/, replacement: resolve(__dirname, 'projects', 'inline-lib') },
    ],
  },
  server: {
    port: 3022,
  },
  test: {
    api: {
      port: 3023,
    },
    name: 'core',
    includeSource: [
      'src/in-source/*.ts',
    ],
    exclude: ['**/fixtures/**', ...defaultExclude],
    slowTestThreshold: 1000,
    testTimeout: process.env.CI ? 10_000 : 5_000,
    preloads: [`data:text/javascript,import { register } from "${pathToFileURL(tsxApi)}";register();`],
    setupFiles: [
      // 'tsx',
      // './test/setup.js',
    ],
    reporters: [['default', { summary: true }], 'hanging-process'],
    testNamePattern: '^((?!does not include test that).)*$',
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html'],
    },
    environmentMatchGlobs: [
      ['**/*.dom.test.ts', 'happy-dom'],
      ['test/env-glob-dom/**', 'jsdom'],
    ],
    poolMatchGlobs: [
      ['**/test/*.child_process.test.ts', 'forks'],
      ['**/test/*.threads.test.ts', 'threads'],
    ],
    environmentOptions: {
      custom: {
        option: 'config-option',
      },
    },
    poolOptions: {
      threads: {
        execArgv: ['--experimental-wasm-modules'],
      },
      forks: {
        execArgv: ['--experimental-wasm-modules'],
      },
    },
    env: {
      CUSTOM_ENV: 'foo',
    },
    resolveSnapshotPath: (path, extension) => {
      if (path.includes('moved-snapshot')) {
        return path + extension
      }
      return join(dirname(path), '__snapshots__', `${basename(path)}${extension}`)
    },
    sequence: {
      seed: 101,
    },
    allowOnly: true,
    deps: {
      moduleDirectories: ['node_modules', 'projects', 'packages'],
    },
    server: {
      deps: {
        external: [
          'tinyspy',
          /src\/external/,
          /esm\/esm/,
          /packages\/web-worker/,
          /\.wasm$/,
          /\/wasm-bindgen-no-cyclic\/index_bg.js/,
        ],
        inline: ['inline-lib'],
      },
    },
    alias: [
      {
        find: 'test-alias',
        replacement: '',
        // vitest doesn't crash because function is defined
        customResolver: () => resolve(__dirname, 'src', 'aliased-mod.ts'),
      },
    ],
    onConsoleLog(log) {
      if (log.includes('Failed to load url') && log.includes('web-worker')) {
        return false
      }
      if (log.includes('Importing WebAssembly ')) {
        return false
      }
    },
  },
})
