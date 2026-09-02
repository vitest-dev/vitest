import { defineConfig, mergeConfig } from 'vitest/config'

import base from './vitest.config'

const VIRTUAL_ID = 'virtual:non-file-url-source'
const RESOLVED_ID = '\0virtual:non-file-url-source'
// A sourceURL that starts with `file://` (passes the coverage-v8 scheme
// filter) but throws in `fileURLToPath` on Windows (null-byte + no
// drive letter). Mirrors the real-world URL shape produced by
// `vitest-plugin-rsc` client-package proxies.
const SOURCE_URL = `file:///\0virtual:non-file-url-source.js`

export default mergeConfig(base, defineConfig({
  plugins: [{
    name: 'coverage-non-file-urls-virtual',
    resolveId(id) {
      if (id === VIRTUAL_ID) {
        return RESOLVED_ID
      }
    },
    load(id) {
      if (id === RESOLVED_ID) {
        return `export function nonFileGreet() {\n  return 'rsc'\n}\n//# sourceURL=${SOURCE_URL}\n`
      }
    },
  }],
}))
