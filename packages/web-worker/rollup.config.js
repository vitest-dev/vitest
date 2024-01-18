import { createRequire } from 'node:module'
import esbuild from 'rollup-plugin-esbuild'
import dts from 'rollup-plugin-dts'
import commonjs from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import json from '@rollup/plugin-json'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const entries = {
  index: 'src/index.ts',
  pure: 'src/pure.ts',
}

const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  /^@?vitest(\/|$)/,
  'vite-node/utils',
]

const plugins = [
  json(),
  nodeResolve(),
  commonjs(),
  esbuild({
    target: 'node18',
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
  {
    input: 'src/pure.ts',
    output: {
      dir: process.cwd(),
      entryFileNames: 'dist/[name].d.ts',
      format: 'esm',
    },
    external,
    plugins: [
      dts({ respectExternal: true }),
    ],
  },
]
