import { createRequire } from 'node:module'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import { defineConfig } from 'rollup'
import oxc from 'unplugin-oxc/rollup'
import { createDtsUtils } from '../../scripts/build-utils.js'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const external = [
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.peerDependencies || {}),
  /^@?vitest(\/|$)/,
  '@vitest/browser/utils',
  '@vitest/browser/context',
  '@vitest/browser/client',
  'vitest/browser',
  'worker_threads',
  'node:worker_threads',
  'vite',
  'vitest/internal/browser',
]

const dtsUtils = createDtsUtils()
const dtsUtilsClient = createDtsUtils({
  // need extra depth to avoid output conflict
  isolatedDeclDir: '.types-client/tester',
  cleanupDir: '.types-client',
})

const plugins = [
  resolve({
    preferBuiltins: true,
  }),
  json(),
  commonjs(),
  oxc({
    transform: { target: 'node20' },
  }),
]

const input = {
  index: './src/node/index.ts',
}

export default () =>
  defineConfig([
    {
      input,
      output: {
        dir: 'dist',
        format: 'esm',
      },
      external,
      context: 'null',
      plugins: [
        {
          name: 'no-side-effects',
          async resolveId(id, importer) {
            // Clipboard injects "afterEach" callbacks
            // We mark it as having no side effects to prevent it from being included in the bundle
            if (id.includes('dataTransfer/Clipboard')) {
              return {
                ...await this.resolve(id, importer),
                moduleSideEffects: false,
              }
            }
          },
        },
        ...dtsUtils.isolatedDecl(),
        ...plugins,
      ],
    },
    {
      input: {
        'locators': './src/client/tester/locators/index.ts',
        'expect-element': './src/client/tester/expect-element.ts',
      },
      output: {
        dir: 'dist',
        format: 'esm',
      },
      external,
      plugins: [
        ...dtsUtilsClient.isolatedDecl(),
        ...plugins.filter(p => p.name !== 'unplugin-oxc'),
        oxc({
          transform: { target: 'node18' },
          minify: true,
        }),
      ],
    },
    {
      input: './src/client/tester/context.ts',
      output: {
        file: 'dist/context.js',
        format: 'esm',
      },
      external: ['vitest/internal/browser'],
      plugins: [
        oxc({
          transform: { target: 'node18' },
        }),
      ],
    },
    {
      input: './src/client/client.ts',
      output: {
        file: 'dist/client.js',
        format: 'esm',
      },
      plugins: [
        resolve({
          preferBuiltins: true,
        }),
        oxc({
          transform: { target: 'node18' },
        }),
      ],
    },
    {
      input: './src/client/tester/state.ts',
      output: {
        file: 'dist/state.js',
        format: 'iife',
      },
      plugins: [
        oxc({
          transform: { target: 'node18' },
        }),
        resolve(),
      ],
    },
    {
      input: dtsUtils.dtsInput(input),
      output: {
        dir: 'dist',
        entryFileNames: '[name].d.ts',
        format: 'esm',
      },
      watch: false,
      external,
      plugins: dtsUtils.dts(),
    },
    {
      input: dtsUtilsClient.dtsInput({
        locators: './src/client/tester/locators/index.ts',
      }),
      output: {
        dir: 'dist',
        entryFileNames: '[name].d.ts',
        format: 'esm',
      },
      watch: false,
      external,
      plugins: dtsUtilsClient.dts(),
    },
  ])
