import { builtinModules, createRequire } from 'node:module'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import { defineConfig } from 'rollup'
import esbuild from 'rollup-plugin-esbuild'
import { rollupDtsHelper } from '../ui/rollup.config.js'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const entries = {
  index: 'src/index.ts',
}

const external = [
  ...builtinModules,
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
]

const dtsHelper = rollupDtsHelper()

const plugins = [
  dtsHelper.isolatedDecl(),
  resolve({
    preferBuiltins: true,
  }),
  json(),
  esbuild({
    target: 'node14',
  }),
  commonjs(),
]

export default defineConfig([
  {
    input: entries,
    output: {
      dir: 'dist',
      format: 'esm',
      entryFileNames: '[name].js',
      chunkFileNames: 'chunk-[name].js',
    },
    external,
    plugins,
    onwarn,
  },
  {
    input: dtsHelper.dtsInput(entries),
    output: {
      dir: 'dist',
      entryFileNames: '[name].d.ts',
      format: 'esm',
    },
    external,
    plugins: [dtsHelper.dts()],
    onwarn,
  },
])

function onwarn(message) {
  if (['EMPTY_BUNDLE', 'CIRCULAR_DEPENDENCY'].includes(message.code)) {
    return
  }
  console.error(message)
}
