import { builtinModules, createRequire } from 'node:module'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import { join } from 'pathe'
import { defineConfig } from 'rollup'
import oxc from 'unplugin-oxc/rollup'
import { createDtsUtils } from '../../scripts/build-utils.js'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const entries = {
  index: 'src/index.ts',
  provider: 'src/provider.ts',
}

const external = [
  ...builtinModules,
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  /^@?vitest(\/|$)/,

  // We bundle istanbul-lib-instrument but don't want to bundle its babel dependency
  '@babel/core',
]

const dtsUtils = createDtsUtils()

const plugins = [
  ...dtsUtils.isolatedDecl(),
  nodeResolve(),
  json(),
  commonjs({
    // "istanbul-lib-source-maps > @jridgewell/trace-mapping" is not CJS
    // "istanbul-lib-instrument > @jridgewell/trace-mapping" is not CJS
    esmExternals: ['@jridgewell/trace-mapping'],
  }),
  oxc({
    transform: { target: 'node20' },
  }),
]

export default defineConfig(() => [
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
    onLog(level, log, handler) {
      // we don't control the source of "istanbul-lib-coverage"
      if (
        level === 'warn'
        && log.exporter === 'istanbul-lib-coverage'
        && log.message.includes('"Range" is imported')
      ) {
        return
      }
      handler(level, log)
    },
  },
])
