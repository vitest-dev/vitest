import { rm } from 'node:fs/promises'
// @ts-check
import { builtinModules, createRequire } from 'node:module'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import { defineConfig } from 'rollup'
import dts from 'rollup-plugin-dts'
import isolatedDecl from 'unplugin-isolated-decl/rollup'
import oxc from 'unplugin-oxc/rollup'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const entries = {
  index: 'src/index.ts',
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
  isolatedDecl({ transformer: 'oxc', extraOutdir: '.types' }),
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
  {
    input: 'dist/.types/index.d.ts',
    output: {
      dir: 'dist',
      entryFileNames: '[name].ts',
      format: 'esm',
    },
    external,
    plugins: [
      dts({ respectExternal: true }),
      {
        name: 'cleanup',
        buildEnd() {
          return rm('./dist/.types', { recursive: true, force: true })
        },
      },
    ],
    onwarn,
  },
])

function onwarn(message) {
  if (['EMPTY_BUNDLE', 'CIRCULAR_DEPENDENCY'].includes(message.code)) {
    return
  }
  console.error(message)
}
