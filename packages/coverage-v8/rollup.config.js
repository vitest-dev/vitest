import { builtinModules, createRequire } from 'node:module'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import { join } from 'pathe'
import esbuild from 'rollup-plugin-esbuild'
import { rollupDtsHelper } from '../ui/rollup.config.js'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const entries = {
  index: 'src/index.ts',
  browser: 'src/browser.ts',
  provider: 'src/provider.ts',
}

const external = [
  ...builtinModules,
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  'node:inspector',
  /^@?vitest(\/|$)/,
]

const dtsHelper = rollupDtsHelper()

const plugins = [
  dtsHelper.isolatedDecl(),
  nodeResolve(),
  json(),
  commonjs(),
  esbuild({
    target: 'node18',
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
    input: dtsHelper.dtsInput(entries),
    output: {
      dir: join(process.cwd(), 'dist'),
      entryFileNames: '[name].d.ts',
      format: 'esm',
    },
    external,
    plugins: [dtsHelper.dts()],
  },
]
