import { rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import { defineConfig } from 'rollup'
import dts from 'rollup-plugin-dts'
import isolatedDecl from 'unplugin-isolated-decl/rollup'
import oxc from 'unplugin-oxc/rollup'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const external = [
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.peerDependencies || {}),
  /^@?vitest(\/|$)/,
  'worker_threads',
  'node:worker_threads',
  'vite',
]

const plugins = [
  resolve({
    preferBuiltins: true,
  }),
  json(),
  commonjs(),
  oxc({
    transform: { target: 'node18' },
  }),
]

const input = {
  index: './src/node/index.ts',
  providers: './src/node/providers/index.ts',
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
        isolatedDecl({ transformer: 'oxc', extraOutdir: '.node-types' }),
        ...plugins,
      ],
    },
    {
      input: {
        'locators/playwright': './src/client/tester/locators/playwright.ts',
        'locators/webdriverio': './src/client/tester/locators/webdriverio.ts',
        'locators/preview': './src/client/tester/locators/preview.ts',
        'locators/index': './src/client/tester/locators/index.ts',
        'utils': './src/client/tester/public-utils.ts',
      },
      output: {
        dir: 'dist',
        format: 'esm',
      },
      external,
      plugins: [
        isolatedDecl({ transformer: 'oxc', extraOutdir: '.client-types' }),
        plugins,
      ],
    },
    {
      input: './src/client/tester/context.ts',
      output: {
        file: 'dist/context.js',
        format: 'esm',
      },
      plugins: [
        oxc({ transform: { target: 'node18' } }),
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
          minify: true,
        }),
        resolve(),
      ],
    },
    {
      input: './dist/.node-types/index.d.ts',
      output: {
        file: 'dist/index.d.ts',
        format: 'esm',
      },
      external,
      plugins: [
        dts({
          respectExternal: true,
        }),
        {
          name: 'cleanup',
          buildEnd() {
            return rm('./dist/.node-types', { recursive: true, force: true })
          },
        },
      ],
    },
    {
      input: {
        'locators/index': './dist/.client-types/locators/index.d.ts',
      },
      output: {
        dir: 'dist',
        format: 'esm',
      },
      external,
      plugins: [
        dts({
          respectExternal: true,
        }),
        {
          name: 'cleanup',
          buildEnd() {
            return rm('./dist/.client-types', { recursive: true, force: true })
          },
        },
      ],
    },
    // {
    //   input: './src/client/tester/jest-dom.ts',
    //   output: {
    //     file: './jest-dom.d.ts',
    //     format: 'esm',
    //   },
    //   external: [],
    //   plugins: [
    //     dts({
    //       respectExternal: true,
    //     }),
    //   ],
    // },
  ])
