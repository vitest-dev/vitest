import { resolve } from 'pathe'
import * as vite from 'vite'

const browserTargets = ['chrome87', 'firefox78', 'safari15.4', 'edge88']

export default vite.defineConfig({
  server: {
    watch: { ignored: ['**/**'] },
  },
  esbuild: {
    target: browserTargets,
    legalComments: 'inline',
  },
  build: {
    target: browserTargets,
    minify: false,
    outDir: '../../dist/client',
    emptyOutDir: false,
    assetsDir: '__vitest_browser__',
    manifest: true,
    rollupOptions: {
      output: 'rolldownVersion' in vite
        ? {
            minify: false,
          } as any
        : {},
      input: {
        orchestrator: resolve(import.meta.dirname, './orchestrator.html'),
        tester: resolve(import.meta.dirname, './tester/tester.html'),
      },
      external: [
        /^vitest\//,
        'vitest',
        /^msw/,
        'vitest/browser',
        '@vitest/browser/client',
      ],
    },
  },
})
