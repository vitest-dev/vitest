import { defineConfig } from "vitest/config"

export default defineConfig({
  define: {
    'import.meta.__IS_INLINE__': 'true',
  },
  resolve: {
    conditions: ['custom'],
  },
  ssr: {
    resolve: {
      conditions: ['custom'],
    },
  }
})
