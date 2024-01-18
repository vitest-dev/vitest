import { builtinModules, createRequire } from 'node:module'
import esbuild from 'rollup-plugin-esbuild'
import dts from 'rollup-plugin-dts'
import { defineConfig } from 'rollup'
import copy from 'rollup-plugin-copy'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const external = [
  ...builtinModules,
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  /^@?vitest(\/|$)/,
]

const plugins = [
  esbuild({
    target: 'node14',
  }),
  copy({
    targets: [
      { src: 'node_modules/@types/chai/index.d.ts', dest: 'dist', rename: 'chai.d.cts' },
    ],
  }),
]

export default defineConfig([
  {
    input: 'src/index.ts',
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
    input: 'src/index.ts',
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
