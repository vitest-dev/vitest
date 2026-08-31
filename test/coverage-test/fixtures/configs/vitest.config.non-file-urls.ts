import { defineConfig, mergeConfig } from 'vitest/config'

import base from './vitest.config'

const VIRTUAL_ID = 'virtual:non-file-url-source'
const RESOLVED_ID = '\0about:/React/Server/synthetic-non-file.js'

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
        return 'export function nonFileGreet() {\n  return \'rsc\'\n}\n'
      }
    },
  }],
}))
