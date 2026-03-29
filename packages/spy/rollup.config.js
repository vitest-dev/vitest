import { defineConfig } from 'rollup'
import oxc from 'unplugin-oxc/rollup'
import { createDtsUtils, externalDependencies, nodejsBuiltinModules } from '../../scripts/build-utils.js'

const external = [
  ...nodejsBuiltinModules,
  ...externalDependencies(import.meta.url, { selfImportList: ['@vitest/spy/optional-types.js'] }),
]

const dtsUtils = createDtsUtils()

const plugins = [
  ...dtsUtils.isolatedDecl(),
  oxc({
    transform: { target: 'node20' },
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
