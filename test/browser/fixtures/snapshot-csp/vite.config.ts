import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'

export default defineConfig({
  cacheDir: path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'node_modules/.vite'
  ),
  server: {
    headers: {
      // CSP without `'unsafe-eval'`: forbids `eval`/`new Function`. Reading an
      // existing snapshot file used to evaluate its content in the browser via
      // `new Function`, which this header blocks. Snapshots must now be
      // evaluated server-side. `'unsafe-inline'` (and no `default-src`) keeps
      // the rest of the browser runtime working, so only the eval path is
      // exercised here.
      'content-security-policy': 'script-src \'self\' \'unsafe-inline\'',
    },
  },
  test: {
    browser: {
      enabled: true,
      provider,
      instances: [instances[0]],
    },
  },
})
