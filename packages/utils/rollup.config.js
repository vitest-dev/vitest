import { builtinModules, createRequire } from 'node:module'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import { defineConfig } from 'rollup'
import oxc from 'unplugin-oxc/rollup'
import { createDtsUtils } from '../../scripts/build-utils.js'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const entries = {
  'index': 'src/index.ts',
  'helpers': 'src/helpers.ts',
  'diff': 'src/diff/index.ts',
  'error': 'src/error.ts',
  'source-map': 'src/source-map.ts',
  'source-map/node': 'src/source-map/node.ts',
  'types': 'src/types.ts',
  'constants': 'src/constants.ts',
  'offset': 'src/offset.ts',
  'timers': 'src/timers.ts',
  'display': 'src/display.ts',
  'resolver': 'src/resolver.ts',
  'serialize': 'src/serialize.ts',
}

const external = [
  ...builtinModules,
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
]

const dtsUtils = createDtsUtils()

const plugins = [
  ...dtsUtils.isolatedDecl(),
  resolve({
    preferBuiltins: true,
  }),
  json(),
  oxc({
    transform: { target: 'node20' },
  }),
  commonjs(),
]

export default defineConfig([
  {
    input: entries,
    treeshake: {
      moduleSideEffects: [
        {
          external: true,
          sideEffects: false,
        },
      ],
    },
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
    watch: false,
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
