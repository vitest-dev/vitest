// @ts-check
import { builtinModules, createRequire } from 'node:module'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import { defineConfig } from 'rollup'
import isolatedDecl from 'unplugin-isolated-decl/rollup'
import oxc from 'unplugin-oxc/rollup'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const entries = {
  'index': 'src/index.ts',
  'helpers': 'src/helpers.ts',
  'diff': 'src/diff/index.ts',
  'error': 'src/error.ts',
  'source-map': 'src/source-map.ts',
  'types': 'src/types.ts',
}

const external = [
  ...builtinModules,
  ...Object.keys(pkg.dependencies || {}),
  // ...Object.keys(pkg.peerDependencies || {}),
]

const plugins = [
  resolve({
    preferBuiltins: true,
  }),
  isolatedDecl({ transformer: 'oxc' }),
  json(),
  oxc({
    transform: { target: 'node14' },
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
])

function onwarn(message) {
  if (['EMPTY_BUNDLE', 'CIRCULAR_DEPENDENCY'].includes(message.code)) {
    return
  }
  console.error(message)
}
