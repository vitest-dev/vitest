import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const provider = process.env.PROVIDER || 'playwright'
const name =
  process.env.BROWSER || (provider === 'playwright' ? 'chromium' : 'chrome')

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
      name,
      headless: true,
    },
    onConsoleLog(log) {
      if (log.includes('ReactDOMTestUtils.act')) {
        return false
      }
    }
  },
})
