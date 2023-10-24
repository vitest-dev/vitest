import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'rollup'
import esbuild from 'rollup-plugin-esbuild'
import dts from 'rollup-plugin-dts'

const __dirname = dirname(fileURLToPath(import.meta.url))

const entries = {
  'index': 'src/index.ts',
  'helpers': 'src/helpers.ts',
  'diff': 'src/diff/index.ts',
  'error': 'src/error.ts',
  'source-map': 'src/source-map.ts',
  'types': 'src/types.ts',
}

const plugins = [
  esbuild({
    // support older browser, since this can run in the browser
    target: ['es2017', 'node18'],
  }),
]

export default defineConfig([
  {
    input: entries,
    output: {
      dir: 'dist',
      format: 'esm',
      entryFileNames: '[name].js',
      chunkFileNames: 'chunk-[name].js',
    },
    plugins,
  },
  {
    input: entries,
    output: {
      dir: 'dist',
      entryFileNames: '[name].d.ts',
      format: 'esm',
    },
    plugins: [
      dts({ respectExternal: true, tsconfig: join(__dirname, 'tsconfig.json') }),
    ],
  },
])
