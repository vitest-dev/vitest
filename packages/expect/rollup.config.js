import { rm } from 'node:fs/promises'
import { builtinModules, createRequire } from 'node:module'
import { defineConfig } from 'rollup'
import copy from 'rollup-plugin-copy'
import dts from 'rollup-plugin-dts'
import isolatedDecl from 'unplugin-isolated-decl/rollup'
import oxc from 'unplugin-oxc/rollup'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const external = [
  ...builtinModules,
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  /^@?vitest(\/|$)/,
]

const plugins = [
  isolatedDecl({ transformer: 'oxc', extraOutdir: '.types' }),
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
    input: 'dist/.types/index.d.ts',
    output: {
      dir: 'dist',
      entryFileNames: '[name].ts',
      format: 'esm',
    },
    external,
    plugins: [dts({ respectExternal: true }), {
      name: 'cleanup',
      buildEnd() {
        return rm('dist/.types', { recursive: true, force: true })
      },
    }],
    onwarn,
  },
])

function onwarn(message) {
  if (['EMPTY_BUNDLE', 'CIRCULAR_DEPENDENCY'].includes(message.code)) {
    return
  }
  console.error(message)
}
