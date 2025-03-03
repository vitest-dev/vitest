// @ts-check
import { builtinModules, createRequire } from 'node:module'
import { defineConfig } from 'rollup'
import isolatedDecl from 'unplugin-isolated-decl/rollup'
import oxc from 'unplugin-oxc/rollup'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const external = [
  ...builtinModules,
  ...Object.keys(pkg.dependencies || {}),
  // ...Object.keys(pkg.peerDependencies || {}),
]

const plugins = [
  isolatedDecl({ transformer: 'oxc' }),
  oxc({
    transform: { target: 'node14' },
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
])

function onwarn(message) {
  if (['EMPTY_BUNDLE', 'CIRCULAR_DEPENDENCY'].includes(message.code)) {
    return
  }
  console.error(message)
}
