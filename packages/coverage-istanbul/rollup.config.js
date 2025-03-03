// @ts-check
import { builtinModules, createRequire } from 'node:module'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import isolatedDecl from 'unplugin-isolated-decl/rollup'
import oxc from 'unplugin-oxc/rollup'

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
]

const plugins = [
  isolatedDecl({ transformer: 'oxc' }),
  nodeResolve(),
  json(),
  commonjs(),
  oxc({
    transform: { target: 'node18' },
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
]
