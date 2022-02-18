import esbuild from 'rollup-plugin-esbuild'
import dts from 'rollup-plugin-dts'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import alias from '@rollup/plugin-alias'
import pkg from './package.json'

const entries = {
  index: 'src/index.ts',
  server: 'src/server.ts',
  types: 'src/types.ts',
  client: 'src/client.ts',
  utils: 'src/utils.ts',
  cli: 'src/cli.ts',
}

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
  {
    input: entries,
    output: {
      dir: 'dist',
      format: 'esm',
      sourcemap: 'inline',
      entryFileNames: '[name].js',
    },
    external,
    plugins,
  },
  {
    input: entries,
    output: {
      dir: 'dist',
      format: 'cjs',
      sourcemap: 'inline',
      entryFileNames: '[name].cjs',
    },
    external,
    plugins,
  },
  {
    input: entries,
    output: {
      dir: process.cwd(),
      entryFileNames: '[name].d.ts',
      format: 'esm',
    },
    external,
    plugins: [
      dts({ respectExternal: true }),
    ],
  },
]
