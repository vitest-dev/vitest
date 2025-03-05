import fs from 'node:fs'
import { builtinModules, createRequire } from 'node:module'
import path from 'node:path'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import { defineConfig } from 'rollup'
import dts from 'rollup-plugin-dts'
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
      external,
      plugins: [
        resolve({
          preferBuiltins: true,
        }),
        isolatedDecl({
          transformer: 'oxc',
          // exclude direct imports to other package sources
          include: path.join(import.meta.dirname, '**/*.ts'),
          extraOutdir: '.types',
        }),
        json(),
        commonjs(),
        esbuild({
          target: 'node18',
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
      external,
      plugins: [
        dts({ respectExternal: true }),
        {
          name: 'cleanup-types',
          buildEnd() {
            fs.rmSync('./dist/.types', { recursive: true, force: true })
          },
        },
      ],
    },
  ])
}

function onwarn(message) {
  if (['EMPTY_BUNDLE', 'CIRCULAR_DEPENDENCY'].includes(message.code)) {
    return
  }
  console.error(message)
}
