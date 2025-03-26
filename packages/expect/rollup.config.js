import { builtinModules, createRequire } from 'node:module'
import { defineConfig } from 'rollup'
import copy from 'rollup-plugin-copy'
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

const dtsUtils = createDtsUtils()

const plugins = [
  ...dtsUtils.isolatedDecl(),
  oxc({
    transform: { target: 'node14' },
  }),
  copy({
    targets: [
      {
        src: 'node_modules/@types/chai/index.d.ts',
        dest: 'dist',
        rename: 'chai.d.cts',
      },
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
    input: dtsUtils.dtsInput('src/index.ts'),
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
