import type { LabelColor } from 'vitest'
import type { Pool } from 'vitest/node'
import { basename, dirname, join, resolve } from 'pathe'
import { defaultExclude, defineConfig } from 'vitest/config'
import { rolldownVersion } from 'vitest/node'

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
      { find: /^#/, replacement: resolve(import.meta.dirname, 'src') },
      { find: /^custom-lib$/, replacement: resolve(import.meta.dirname, 'projects', 'custom-lib') },
      { find: /^inline-lib$/, replacement: resolve(import.meta.dirname, 'projects', 'inline-lib') },
    ],
    noExternal: [/projects\/vite-external/],
  },
  environments: {
    ssr: {
      resolve: {
        noExternal: [/projects\/vite-environment-external/],
      },
    },
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
    exclude: [
      '**/fixtures/**',
      ...defaultExclude,
      // FIXME: wait for ecma decorator support in rolldown/oxc
      // https://github.com/oxc-project/oxc/issues/9170
      ...(rolldownVersion ? ['**/esnext.test.ts'] : []),
    ],
    slowTestThreshold: 1000,
    testTimeout: process.env.CI ? 10_000 : 5_000,
    setupFiles: [
      './test/setup.ts',
    ],
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
    includeTaskLocation: true,
    reporters: process.env.GITHUB_ACTIONS
      ? ['default', 'github-actions']
      : [['default', { summary: true }], 'hanging-process'],
    testNamePattern: '^((?!does not include test that).)*$',
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html'],
    },
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.typecheck.json',
    },
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
    alias: [
      {
        find: 'test-alias',
        replacement: '',
        // vitest doesn't crash because function is defined
        customResolver: () => resolve(import.meta.dirname, 'src', 'aliased-mod.ts'),
      },
    ],
    onConsoleLog(log) {
      if (log.includes('Failed to load url') && log.includes('web-worker')) {
        return false
      }
      if (log.includes('Importing WebAssembly ')) {
        return false
      }
      if (log.includes('run [...filters]')) {
        return false
      }
      if (log.startsWith(`[vitest]`) && log.includes(`did not use 'function' or 'class' in its implementation`)) {
        return false
      }
    },
    projects: [
      project('threads', 'red'),
      project('forks', 'green'),
      project('vmThreads', 'blue'),
    ],
  },
})

function project(pool: Pool, color: LabelColor) {
  return {
    extends: './vite.config.ts',
    test: {
      name: { label: pool, color },
      pool,
    },
  }
}
