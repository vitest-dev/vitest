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
  'index': 'src/index.ts',
  'server': 'src/server.ts',
  'types': 'src/types.ts',
  'client': 'src/client.ts',
  'utils': 'src/utils.ts',
  'cli': 'src/cli.ts',
  'constants': 'src/constants.ts',
  'hmr': 'src/hmr/index.ts',
  'source-map': 'src/source-map.ts',
}

const external = [
  ...builtinModules,
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  'pathe',
  'birpc',
  'vite',
  'node:url',
  'node:events',
  'node:vm',
]

const dtsHelper = rollupDtsHelper()

const plugins = [
  resolve({
    preferBuiltins: true,
  }),
  json(),
  commonjs(),
  esbuild({
    target: 'node14',
    define: process.env.NO_VITE_TEST_WATCHER_DEBUG
      ? { 'process.env.VITE_TEST_WATCHER_DEBUG': 'false' }
      : {},
  }),
]

export default defineConfig([
  {
    input: entries,
    output: {
      dir: 'dist',
      format: 'esm',
      entryFileNames: '[name].mjs',
      chunkFileNames: 'chunk-[name].mjs',
    },
    external,
    plugins: [
      {
        // TODO: move it to dtsHelper
        name: 'silence-isolated-decl-type-import-error',
        resolveId(id) {
          return id.startsWith('vite/types/') ? '/node_modules/' : undefined
        },
      },
      dtsHelper.isolatedDecl(),
      ...plugins,
    ],
    onwarn,
  },
  {
    input: entries,
    output: {
      dir: 'dist',
      format: 'cjs',
      entryFileNames: '[name].cjs',
      chunkFileNames: 'chunk-[name].cjs',
    },
    external,
    plugins,
    onwarn,
  },
  {
    input: dtsHelper.dtsInput(entries, { ext: 'mts' }),
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
