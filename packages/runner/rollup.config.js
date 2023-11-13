import { builtinModules, createRequire } from 'node:module'
import esbuild from 'rollup-plugin-esbuild'
import json from '@rollup/plugin-json'
import dts from 'rollup-plugin-dts'
import { defineConfig } from 'rollup'

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
  types: 'src/types/index.ts',
}

const plugins = [
  esbuild({
    target: 'node14',
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
    input: entries,
    output: {
      dir: 'dist',
      entryFileNames: '[name].d.ts',
      format: 'esm',
    },
    external,
    plugins: [
      dts({ respectExternal: true }),
    ],
    onwarn,
  },
])

function onwarn(message) {
  if (['EMPTY_BUNDLE', 'CIRCULAR_DEPENDENCY'].includes(message.code))
    return
  console.error(message)
}
