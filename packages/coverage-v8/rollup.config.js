import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import { join } from 'pathe'
import oxc from 'unplugin-oxc/rollup'
import { createDtsUtils, externalDependencies, nodejsBuiltinModules } from '../../scripts/build-utils.js'

const entries = {
  index: 'src/index.ts',
  browser: 'src/browser.ts',
  provider: 'src/provider.ts',
}

const external = [
  ...nodejsBuiltinModules,
  ...externalDependencies(import.meta.url),
]

const dtsUtils = createDtsUtils()

const plugins = [
  ...dtsUtils.isolatedDecl(),
  nodeResolve(),
  json(),
  commonjs(),
  oxc({
    transform: { target: 'node20' },
  }),
]

export default () => [
  {
    input: entries,
    output: {
      dir: 'dist',
      format: 'esm',
    },
    external,
    plugins,
  },
  {
    input: dtsUtils.dtsInput(entries),
    output: {
      dir: join(process.cwd(), 'dist'),
      entryFileNames: '[name].d.ts',
      format: 'esm',
    },
    watch: false,
    external,
    plugins: dtsUtils.dts(),
  },
]
