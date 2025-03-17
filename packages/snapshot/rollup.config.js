import { builtinModules, createRequire } from 'node:module'
import commonjs from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import { defineConfig } from 'rollup'
import esbuild from 'rollup-plugin-esbuild'
import { createDtsUtils } from '../../scripts/build-utils.js'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const external = [
  ...builtinModules,
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
]

const entries = {
  index: 'src/index.ts',
  environment: 'src/environment.ts',
  manager: 'src/manager.ts',
}

const dtsUtils = createDtsUtils()

const plugins = [
  ...dtsUtils.isolatedDecl(),
  nodeResolve({
    preferBuiltins: true,
  }),
  commonjs(),
  esbuild({
    target: 'node14',
  }),
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
    input: dtsUtils.dtsInput(entries),
    output: {
      dir: 'dist',
      entryFileNames: '[name].d.ts',
      format: 'esm',
    },
    external,
    plugins: dtsUtils.dts(),
    onwarn,
  },
])

function onwarn(message) {
  if (['EMPTY_BUNDLE', 'CIRCULAR_DEPENDENCY'].includes(message.code)) {
    return
  }
  console.error(message)
}
