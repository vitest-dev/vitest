import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'pathe'
import { globSync } from 'tinyglobby'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    watch: { ignored: ['**/**'] },
  },
  esbuild: {
    legalComments: 'inline',
  },
  build: {
    minify: false,
    outDir: '../../dist/client',
    emptyOutDir: false,
    assetsDir: '__vitest_browser__',
    manifest: true,
    rollupOptions: {
      input: {
        orchestrator: resolve(__dirname, './orchestrator.html'),
        tester: resolve(__dirname, './tester/tester.html'),
      },
      external: [
        /^vitest\//,
        'vitest',
        /^msw/,
        '@vitest/browser/context',
        '@vitest/browser/client',
      ],
    },
  },
  plugins: [
    {
      name: 'copy-ui-plugin',

      closeBundle: async () => {
        const root = resolve(
          fileURLToPath(import.meta.url),
          '../../../../../packages',
        )

        const ui = resolve(root, 'ui/dist/client')
        const uiEntryPoint = resolve(ui, 'index.html')
        const browser = resolve(root, 'browser/dist/client/__vitest__/')

        const timeout = setTimeout(
          () => console.log('[copy-ui-plugin] Waiting for UI to be built...'),
          1000,
        )
        await waitFor(() => fs.existsSync(ui) && fs.existsSync(uiEntryPoint))
        clearTimeout(timeout)

        const files = globSync(['**/*'], { cwd: ui, expandDirectories: false })

        if (fs.existsSync(browser)) {
          fs.rmSync(browser, { recursive: true })
        }

        fs.mkdirSync(browser, { recursive: true })
        fs.mkdirSync(resolve(browser, 'assets'))

        files.forEach((f) => {
          fs.copyFileSync(resolve(ui, f), resolve(browser, f))
        })

        console.log('[copy-ui-plugin] UI copied')
      },
    },
  ],
})

async function waitFor(method: () => boolean, retries = 100): Promise<void> {
  if (method()) {
    return
  }

  if (retries === 0) {
    throw new Error('Timeout in waitFor')
  }

  await new Promise(resolve => setTimeout(resolve, 500))

  return waitFor(method, retries - 1)
}
