import { createRequire } from 'node:module'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import { defineConfig } from 'rollup'
import esbuild from 'rollup-plugin-esbuild'
import { rollupDtsHelper } from '../ui/rollup.config.js'

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

const dtsHelper = rollupDtsHelper()

const plugins = [
  dtsHelper.isolatedDecl(),
  json(),
  nodeResolve(),
  commonjs(),
  esbuild({
    target: 'node18',
  }),
]

export default () => defineConfig([
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
    plugins: [dtsHelper.dts()],
  },
])
