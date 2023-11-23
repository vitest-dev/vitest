import { basename, dirname, join, resolve } from 'pathe'
import { defaultExclude, defineConfig } from 'vitest/config'

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
    name: 'core',
    exclude: ['**/fixtures/**', '**/vm-wasm.test.ts', ...defaultExclude],
    slowTestThreshold: 1000,
    testTimeout: 2000,
    setupFiles: [
      './test/setup.ts',
    ],
    testNamePattern: '^((?!does not include test that).)*$',
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html'],
    },
    env: {
      CUSTOM_ENV: 'foo',
    },
    poolMatchGlobs: [
      ['**/vm-wasm.test.ts', 'vmThreads'],
    ],
    resolveSnapshotPath: (path, extension) => {
      if (path.includes('moved-snapshot'))
        return path + extension
      return join(dirname(path), '__snapshots__', `${basename(path)}${extension}`)
    },
    sequence: {
      seed: 101,
    },
    deps: {
      moduleDirectories: ['node_modules', 'projects', 'packages'],
    },
    server: {
      deps: {
        external: ['tinyspy', /src\/external/, /esm\/esm/, /\.wasm$/],
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
  },
})
