import { defineConfig } from 'tsup'

export default defineConfig({
  entryPoints: [
    'src/index.ts',
    'src/node/cli.ts',
    'src/node/entry.ts',
  ],
  format: ['esm'],
  clean: true,
  target: 'node16',
})
