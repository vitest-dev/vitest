import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'pathe'

export const distClientRoot: string = resolve(fileURLToPath(import.meta.url), '../client')

export function resolvePlaywrightTraceViewerRoot(root: string): string | undefined {
  const projectRequire = createRequire(resolve(root, 'package.json'))
  for (const packageName of ['playwright', '@playwright/test']) {
    try {
      const packagePath = projectRequire.resolve(`${packageName}/package.json`)
      const packageRequire = createRequire(packagePath)
      const playwrightCorePath = packageRequire.resolve('playwright-core/package.json')
      return resolve(dirname(playwrightCorePath), 'lib/vite/traceViewer')
    }
    catch {}
  }
}
