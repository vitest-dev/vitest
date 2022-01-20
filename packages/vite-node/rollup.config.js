import esbuild from 'rollup-plugin-esbuild'
import dts from 'rollup-plugin-dts'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import alias from '@rollup/plugin-alias'
import pkg from './package.json'

const entries = [
  'src/index.ts',
  'src/server.ts',
  'src/client.ts',
  'src/utils.ts',
  'src/cli.ts',
]

const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  'birpc',
  'vite',
]

const plugins = [
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
]

export default () => [
  ...entries.map(input => ({
    input,
    output: [
      {
        file: input.replace('src/', 'dist/').replace('.ts', '.js'),
        format: 'esm',
      },
      {
        file: input.replace('src/', 'dist/').replace('.ts', '.cjs'),
        format: 'cjs',
      },
    ],
    external,
    plugins,
  })),
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
