import esbuild from 'rollup-plugin-esbuild'
import dts from 'rollup-plugin-dts'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import alias from '@rollup/plugin-alias'
import nodePolyfills from 'rollup-plugin-node-polyfills'
import pkg from './package.json'

const entry = [
  './node/index.ts',
  './client/module.ts',
  './client/noop.ts',
  './client/perf_hooks.ts',
  './client/vitest.ts',
]

const external = [
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.peerDependencies || {}),
  'worker_threads',
]

const nodeConfig = nodePolyfills({ fs: true, crypto: true })

export default () => [
  {
    input: entry,
    output: {
      dir: 'dist',
      format: 'esm',
    },
    external,
    plugins: [
      alias({
        entries: [{ find: /^node:(.+)$/, replacement: '$1' }],
      }),
      {
        name: 'vitest:web',
        resolveId(id, importer) {
          if (id === 'util')
            return nodeConfig.resolveId(id, importer)

          if (id === 'tty')
            return nodeConfig.resolveId(id, importer)

          if (id === 'process')
            return nodeConfig.resolveId(id, importer)

          if (id === 'path')
            return nodeConfig.resolveId(id, importer)

          if (id === 'fs')
            return './client/noop.ts'

          if (id === 'local-pkg')
            return './client/local-pkg.ts'

          if (id === 'module')
            return './client/module.ts'

          if (id === 'perf_hooks')
            return './client/perf_hooks.ts'

          return null
        },
      },

      resolve({
        preferBuiltins: true,
      }),
      json(),
      commonjs(),
      esbuild({
        target: 'node14',
      }),
    ],
    onwarn(message) {
      if (message.code === 'CIRCULAR_DEPENDENCY')
        return
      console.error(message)
    },
  },
  {
    input: './node/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'esm',
    },
    external,
    plugins: [dts()],
  },
]
