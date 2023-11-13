import { builtinModules, createRequire } from 'node:module'
import esbuild from 'rollup-plugin-esbuild'
import nodeResolve from '@rollup/plugin-node-resolve'
import dts from 'rollup-plugin-dts'
import commonjs from '@rollup/plugin-commonjs'
import { defineConfig } from 'rollup'

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

const plugins = [
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
