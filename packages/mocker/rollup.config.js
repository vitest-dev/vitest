import { builtinModules, createRequire } from 'node:module'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import { defineConfig } from 'rollup'
import esbuild from 'rollup-plugin-esbuild'
import { createDtsUtils } from '../../scripts/build-utils.js'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const entries = {
  'index': 'src/index.ts',
  'node': 'src/node/index.ts',
  'redirect': 'src/node/redirect.ts',
  'browser': 'src/browser/index.ts',
  'register': 'src/browser/register.ts',
  'auto-register': 'src/browser/auto-register.ts',
}

const external = [
  ...builtinModules,
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  /^msw/,
]

const dtsUtils = createDtsUtils()

/** @type {import('rollup').Plugin[]} */
const plugins = [
  {
    // silence resolution error by isolated-decl transform of type import
    name: 'ignore-isolated-decl-type-import-resolve-error',
    resolveId(source) {
      return source.startsWith('vite/types/') ? { id: '/node_modules/', external: true } : undefined
    },
  },
  dtsUtils.isolatedDecl(),
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
    input: dtsUtils.dtsInput(entries),
    output: {
      dir: 'dist',
      entryFileNames: '[name].d.ts',
      format: 'esm',
    },
    external,
    plugins: [dtsUtils.dts()],
    onwarn,
  },
])

function onwarn(message) {
  if (['EMPTY_BUNDLE', 'CIRCULAR_DEPENDENCY'].includes(message.code)) {
    return
  }
  console.error(message)
}
