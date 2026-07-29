import { createRequire } from 'node:module'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import { defineConfig } from 'rollup'
import oxc from 'unplugin-oxc/rollup'
import { createDtsUtils } from '../../scripts/build-utils.js'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const external = [
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.peerDependencies || {}),
  /^@?vitest(\/|$)/,
  'vite',
]

const dtsUtils = createDtsUtils()

const plugins = [
  resolve({
    preferBuiltins: true,
  }),
  json(),
  commonjs(),
  oxc({
    transform: { target: 'node20' },
  }),
]

export default () =>
  defineConfig([
    {
      input: {
        index: './src/index.ts',
        locators: './src/locators.ts',
      },
      output: {
        dir: 'dist',
        format: 'esm',
      },
      external,
      context: 'null',
      plugins: [
        ...dtsUtils.isolatedDecl(),
        ...plugins,
      ],
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
    },
  ])
