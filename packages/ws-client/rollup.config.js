import esbuild from 'rollup-plugin-esbuild'
import dts from 'rollup-plugin-dts'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'

const entry = [
  'src/index.ts',
]

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

export default () => [
  {
    input: entry,
    output: {
      dir: 'dist',
      format: 'esm',
    },
    external,
    plugins: [
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
    input: [
      'src/index.ts',
    ],
    output: {
      file: 'dist/index.d.ts',
      format: 'esm',
    },
    external,
    plugins: [
      dts(),
    ],
  },
]
