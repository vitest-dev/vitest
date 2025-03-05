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

export function rollupDtsHelper() {
  return {
    isolatedDecl() {
      return isolatedDecl({
        transformer: 'oxc',
        // exclude direct imports to other package sources
        include: path.join(process.cwd(), '**/*.ts'),
        extraOutdir: '.types',
      })
    },
    dts() {
      return {
        ...dts({ respectExternal: true }),
        closeBundle() {
          fs.rmSync('./dist/.types', { recursive: true, force: true })
        },
      }
    },
  }
}

const dtsHelper = rollupDtsHelper()

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
        dtsHelper.isolatedDecl(),
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
      plugins: [dtsHelper.dts()],
    },
  ])
}

function onwarn(message) {
  if (['EMPTY_BUNDLE', 'CIRCULAR_DEPENDENCY'].includes(message.code)) {
    return
  }
  console.error(message)
}
