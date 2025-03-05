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
    /**
     * @returns {import('rollup').Plugin} dts
     */
    dts() {
      return {
        ...dts({ respectExternal: true }),
        buildEnd() {
          // keep on watch mode since removing types makes re-build flaky
          if (!this.meta.watchMode) {
            fs.rmSync('dist/.types', { recursive: true, force: true })
          }
        },
      }
    },
    /**
     * @param {Record<string, string> | string} input
     */
    dtsInput(input) {
      if (typeof input === 'string') {
        const name = path.basename(input).replace('.ts', '')
        input = { [name]: input }
      }
      return Object.fromEntries(
        Object.entries(input).map(([name, file]) => [
          name,
          path.join('dist/.types', path.basename(file).replace('.ts', '.d.ts')),
        ]),
      )
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
        dtsHelper.isolatedDecl(),
        resolve({
          preferBuiltins: true,
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
