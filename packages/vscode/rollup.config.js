import esbuild from 'rollup-plugin-esbuild'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import alias from '@rollup/plugin-alias'

const entry = [
  'src/index.ts',
]

const external = [
  'vscode',
]

export default [
  {
    input: entry,
    output: {
      dir: 'dist',
      format: 'cjs',
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
]
