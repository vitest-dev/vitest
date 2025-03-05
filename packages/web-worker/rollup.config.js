import fs from 'node:fs'
import { createRequire } from 'node:module'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import dts from 'rollup-plugin-dts'
import esbuild from 'rollup-plugin-esbuild'
import isolatedDecl from 'unplugin-isolated-decl/rollup'

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
  isolatedDecl({
    transformer: 'oxc',
    extraOutdir: '.types',
  }),
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
    input: 'dist/.types/pure.d.ts',
    output: {
      dir: 'dist',
      entryFileNames: '[name].ts',
      format: 'esm',
    },
    external,
    plugins: [
      dts({ respectExternal: true }),
      {
        name: 'cleanup-types',
        buildEnd() {
          fs.rmSync('./dist/.types', { recursive: true, force: true })
        },
      },
    ],
  },
]
