import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import esbuild from 'rollup-plugin-esbuild'
import dts from 'rollup-plugin-dts'
import { defineConfig } from 'rollup'
import copy from 'rollup-plugin-copy'

const __dirname = dirname(fileURLToPath(import.meta.url))

const plugins = [
  esbuild({
    // support older browser, since this can run in the browser
    target: ['es2017', 'node18'],
  }),
  copy({
    targets: [
      { src: join(__dirname, 'node_modules/@types/chai/index.d.ts'), dest: join(__dirname, 'dist'), rename: 'chai.d.cts' },
    ],
  }),
]

export default defineConfig([
  {
    input: 'src/index.ts',
    output: {
      dir: 'dist',
      format: 'esm',
      entryFileNames: '[name].js',
      chunkFileNames: 'chunk-[name].js',
    },
    plugins,
  },
  {
    input: 'src/index.ts',
    output: {
      dir: 'dist',
      entryFileNames: '[name].d.ts',
      format: 'esm',
    },
    plugins: [
      dts({ respectExternal: true }),
    ],
  },
])
