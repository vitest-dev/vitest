import esbuild from 'rollup-plugin-esbuild'
import dts from 'rollup-plugin-dts'

const plugins = [
  esbuild({
    target: 'node18',
  }),
]

export default () => [
  {
    input: [
      './src/node/index.ts',
    ],
    output: {
      dir: 'dist',
      format: 'esm',
    },
    plugins,
  },
  {
    input: './src/node/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
  },
]
