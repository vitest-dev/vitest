import { defineConfig } from 'tsup'

export default defineConfig({
  entryPoints: [
    'src/index.ts',
    'src/node/cli.ts',
    'src/node/worker.ts',
    'src/runtime/entry.ts',
  ],
  format: ['esm'],
  clean: true,
  target: 'node16',
  // TODO: enable source map when public
  // sourcemap: 'external',
})
