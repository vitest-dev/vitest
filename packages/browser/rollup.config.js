import { createRequire } from 'node:module'
import esbuild from 'rollup-plugin-esbuild'
import dts from 'rollup-plugin-dts'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import { defineConfig } from 'rollup'

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
  esbuild({
    target: 'node18',
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
      plugins,
    },
    {
      input: './src/client/tester/context.ts',
      output: {
        file: 'dist/context.js',
        format: 'esm',
      },
      plugins: [
        esbuild({
          target: 'node18',
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
        esbuild({
          target: 'node18',
        }),
      ],
    },
    {
      input: './src/client/tester/state.ts',
      output: {
        file: 'dist/state.js',
        format: 'esm',
      },
      plugins: [
        esbuild({
          target: 'node18',
          minifyWhitespace: true,
        }),
        resolve(),
      ],
    },
    {
      input: input.index,
      output: {
        file: 'dist/index.d.ts',
        format: 'esm',
      },
      external,
      plugins: [
        dts({
          respectExternal: true,
        }),
      ],
    },
    {
      input: './src/client/tester/jest-dom.ts',
      output: {
        file: './jest-dom.d.ts',
        format: 'esm',
      },
      external: [],
      plugins: [
        dts({
          respectExternal: true,
        }),
      ],
    },
  ])
