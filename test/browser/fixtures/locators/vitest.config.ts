import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'

export default defineConfig({
  optimizeDeps: {
    include: ['react/jsx-dev-runtime'],
  },
  cacheDir: fileURLToPath(new URL("./node_modules/.vite", import.meta.url)),
  test: {
    setupFiles: ['vitest-browser-react'],
    browser: {
      enabled: true,
      provider,
      headless: true,
      instances,
    },
    onConsoleLog(log) {
      if (log.includes('ReactDOMTestUtils.act')) {
        return false
      }
    }
  },
})
