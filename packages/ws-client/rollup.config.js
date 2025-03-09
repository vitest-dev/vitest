import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import esbuild from 'rollup-plugin-esbuild'
import { createDtsUtils } from '../../scripts/build-utils.js'

const entry = ['src/index.ts']

const external = [
  'ws',
  'birpc',
  'worker_threads',
  'node:worker_threads',
  'fs',
  'node:fs',
  'vitest',
  'inspector',
  '@vitest/snapshot/environment',
  '@vitest/snapshot/manager',
]

const dtsUtils = createDtsUtils()

export default () => [
  {
    input: entry,
    output: {
      dir: 'dist',
      format: 'esm',
    },
    external,
    plugins: [
      ...dtsUtils.isolatedDecl(),
      resolve({
        preferBuiltins: true,
      }),
      json(),
      commonjs(),
      esbuild({
        target: 'node18',
      }),
    ],
  },
  {
    input: dtsUtils.dtsInput('src/index.ts'),
    output: {
      dir: 'dist',
      entryFileNames: '[name].d.ts',
      format: 'esm',
    },
    external,
    plugins: dtsUtils.dts(),
  },
]
