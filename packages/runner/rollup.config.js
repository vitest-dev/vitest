// @ts-check
import { builtinModules, createRequire } from 'node:module'
import json from '@rollup/plugin-json'
import { defineConfig } from 'rollup'
import isolatedDecl from 'unplugin-isolated-decl/rollup'
import oxc from 'unplugin-oxc/rollup'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const external = [
  ...builtinModules,
  ...Object.keys(pkg.dependencies || {}),
  // ...Object.keys(pkg.peerDependencies || {}),
  /^@?vitest(\/|$)/,
]

const entries = {
  index: 'src/index.ts',
  utils: 'src/utils/index.ts',
  types: 'src/types.ts',
}

const plugins = [
  isolatedDecl({ transformer: 'oxc' }),
  oxc({
    transform: { target: 'node14' },
  }),
  json(),
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
