import { builtinModules, createRequire } from 'node:module'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import { defineConfig } from 'rollup'
import oxc from 'unplugin-oxc/rollup'
import { createDtsUtils } from '../../scripts/build-utils.js'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const external = [
  ...builtinModules,
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.peerDependencies || {}),
  'worker_threads',
  'node:worker_threads',
  /^@?vitest(\/|$)/,
  'vite',
]

const dtsUtils = createDtsUtils()

export default () => {
  return defineConfig([
    {
      input: {
        index: `./node/index.ts`,
        reporter: `./node/reporter.ts`,
      },
      output: {
        dir: 'dist',
        format: 'esm',
      },
      moduleContext: (id) => {
        // mime has `this.__classPrivateFieldGet` check which should be ignored in esm
        if (id.includes('mime/dist/src') || id.includes('mime\\dist\\src')) {
          return '{}'
        }
      },
      external,
      plugins: [
        ...dtsUtils.isolatedDecl(),
        resolve({
          preferBuiltins: true,
        }),
        json(),
        commonjs(),
        oxc({
          transform: { target: 'node18' },
        }),
      ],
      onwarn,
    },
    {
      input: 'dist/.types/index.d.ts',
      output: {
        dir: 'dist',
        entryFileNames: '[name].ts',
        format: 'esm',
      },
      watch: false,
      external,
      plugins: dtsUtils.dts(),
    },
  ])
}

function onwarn(message) {
  if (['EMPTY_BUNDLE', 'CIRCULAR_DEPENDENCY'].includes(message.code)) {
    return
  }
  console.error(message)
}
