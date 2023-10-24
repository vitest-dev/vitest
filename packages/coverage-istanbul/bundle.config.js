import esbuild from 'rollup-plugin-esbuild'
import dts from 'rollup-plugin-dts'

const entries = {
  index: 'src/index.ts',
  provider: 'src/provider.ts',
}

const plugins = [
  esbuild({
    target: 'node18',
  }),
]

export default () => [
  {
    input: entries,
    output: {
      dir: 'dist',
      format: 'esm',
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
]
