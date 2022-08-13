import type { Options } from 'tsup'

export const tsup: Options = {
  clean: true,
  format: ['cjs', 'esm'],
  dts: true,
  entryPoints: [
    'src/index.ts',
  ],
}
