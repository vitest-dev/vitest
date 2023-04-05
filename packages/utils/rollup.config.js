import { builtinModules } from 'node:module'
import { defineConfig } from 'rollup'
import esbuild from 'rollup-plugin-esbuild'
import dts from 'rollup-plugin-dts'
import resolve from '@rollup/plugin-node-resolve'
import json from '@rollup/plugin-json'
import pkg from './package.json' assert { type: 'json' }

const entries = {
  index: 'src/index.ts',
  helpers: 'src/helpers.ts',
  diff: 'src/diff.ts',
  types: 'src/types.ts',
}

const external = [
  ...builtinModules,
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
]

const plugins = [
  resolve({
    preferBuiltins: true,
  }),
  json(),
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
