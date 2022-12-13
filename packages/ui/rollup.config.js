import { builtinModules } from 'module'
import esbuild from 'rollup-plugin-esbuild'
import dts from 'rollup-plugin-dts'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import alias from '@rollup/plugin-alias'
import pkg from './package.json'

const external = [
  ...builtinModules,
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.peerDependencies || {}),
  'worker_threads',
]

export default () => [
  'index',
  'reporter',
].map(entry => [
  {
    input: `./node/${entry}.ts`,
    output: {
      dir: 'dist',
      format: 'esm',
    },
    external,
    plugins: [
      alias({
        entries: [
          { find: /^node:(.+)$/, replacement: '$1' },
        ],
      }),
      resolve({
        preferBuiltins: true,
      }),
      json(),
      commonjs(),
      esbuild({
        target: 'node14',
      }),
    ],
    onwarn,
  },
  {
    input: `./node/${entry}.ts`,
    output: {
      file: `dist/${entry}.d.ts`,
      format: 'esm',
    },
    external,
    plugins: [
      dts(),
    ],
  },
]).flat()

function onwarn(message) {
  if (['EMPTY_BUNDLE', 'CIRCULAR_DEPENDENCY'].includes(message.code))
    return
  console.error(message)
}
