import { builtinModules, createRequire } from 'node:module'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import esbuild from 'rollup-plugin-esbuild'
import isolatedDecl from 'unplugin-isolated-decl/rollup'

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

export default () => {
  return [
    {
      input: {
        index: `./node/index.ts`,
        reporter: `./node/reporter.ts`,
      },
      output: {
        dir: 'dist',
        format: 'esm',
      },
      external,
      plugins: [
        resolve({
          preferBuiltins: true,
        }),
        isolatedDecl({
          transformer: 'oxc',
          include: '**/ui/node/**',
        }),
        json(),
        commonjs(),
        esbuild({
          target: 'node18',
        }),
      ],
      onwarn,
    },
  ]
}

function onwarn(message) {
  if (['EMPTY_BUNDLE', 'CIRCULAR_DEPENDENCY'].includes(message.code)) {
    return
  }
  console.error(message)
}
