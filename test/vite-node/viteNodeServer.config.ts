import { defineConfig } from 'vite'

export default defineConfig({
  nodeServer: {
    debug: {
      dumpModules: true,
    },
  },
})
