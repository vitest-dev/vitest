import { builtinModules, createRequire } from 'node:module'
import json from '@rollup/plugin-json'
import { defineConfig } from 'rollup'
import oxc from 'unplugin-oxc/rollup'
import { createDtsUtils } from '../../scripts/build-utils.js'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const external = [
  ...builtinModules,
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  /^@?vitest(\/|$)/,
]

const entries = {
  index: 'src/index.ts',
  utils: 'src/utils/index.ts',
  types: 'src/types.ts',
}

const dtsUtils = createDtsUtils()

const plugins = [
  ...dtsUtils.isolatedDecl(),
  oxc({
    transform: { target: 'node14' },
  }),
  json(),
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
    watch: false,
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
