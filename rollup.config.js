import esbuild from 'rollup-plugin-esbuild'
import dts from 'rollup-plugin-dts'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import alias from '@rollup/plugin-alias'
import pkg from './package.json'

const entry = [
  'src/index.ts',
  'src/node/cli.ts',
  'src/runtime/worker.ts',
  'src/runtime/entry.ts',
]

const external = [
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.peerDependencies),
  'worker_threads',
]

export default [
  {
    input: entry,
    output: {
      dir: 'dist',
      format: 'esm',
      sourcemap: true,
    },
    external,
    plugins: [
      alias({
        entries: [
          { find: /^node:(.+)$/, replacement: '$1' },
        ],
      }),
      resolve(),
      json(),
      commonjs(),
      esbuild({
        target: 'node14',
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
