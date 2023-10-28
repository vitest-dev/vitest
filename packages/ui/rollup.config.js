import { builtinModules } from 'node:module'
import esbuild from 'rollup-plugin-esbuild'
import dts from 'rollup-plugin-dts'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import pkg from './package.json' assert { type: 'json' }

const external = [
  ...builtinModules,
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.peerDependencies || {}),
  'worker_threads',
  'node:worker_threads',
  'vitest/node',
  'vitest/config',
  'vite',
  'vitest',
]

const entries = [
  'index',
  'reporter',
]

export default () => {
  const options = entries.flatMap(entry => [
    {
      input: `./node/${entry}.ts`,
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
      onwarn,
    },
  ])
  return [
    ...options,
    {
      input: `./node/index.ts`,
      output: {
        file: `dist/index.d.ts`,
        format: 'esm',
      },
      external,
      plugins: [
        dts(),
      ],
    },
  ]
}

function onwarn(message) {
  if (['EMPTY_BUNDLE', 'CIRCULAR_DEPENDENCY'].includes(message.code))
    return
  console.error(message)
}
