import esbuild from 'rollup-plugin-esbuild'
import dts from 'rollup-plugin-dts'
import { defineConfig } from 'rollup'

const entries = {
  index: 'src/index.ts',
  environment: 'src/environment.ts',
  manager: 'src/manager.ts',
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
      dts({ respectExternal: true }),
    ],
  },
])
