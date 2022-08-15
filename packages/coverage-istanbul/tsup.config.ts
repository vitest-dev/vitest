import type { Options } from 'tsup'

export const tsup: Options = {
  clean: true,
  format: ['esm'],
  dts: true,
  entryPoints: [
    'src/index.ts',
  ],
}
