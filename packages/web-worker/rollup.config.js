import esbuild from 'rollup-plugin-esbuild'
import dts from 'rollup-plugin-dts'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import alias from '@rollup/plugin-alias'
import pkg from './package.json'

const entries = [
  'src/index.ts',
  'src/pure.ts',
]

const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  'vitest',
]

const plugins = [
  alias({
    entries: [
      { find: /^node:(.+)$/, replacement: '$1' },
    ],
  }),
  json(),
  commonjs(),
  esbuild({
    target: 'node14',
  }),
]

export default () => [
  {
    input: entries,
    output: {
      dir: 'dist',
      format: 'esm',
    },
    external,
    plugins,
  },
  ...entries.map(input => ({
    input,
    output: {
      file: input.replace('src/', '').replace('.ts', '.d.ts'),
      format: 'esm',
    },
    external,
    plugins: [
      dts({ respectExternal: true }),
    ],
  })),
]
