import { defineConfig } from 'vite'
import { createVuePlugin as Vue2 } from 'vite-plugin-vue2'
import ScriptSetup from 'unplugin-vue2-script-setup/vite'

export default defineConfig({
  plugins: [
    Vue2(),
    ScriptSetup(),
  ],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: [
      'vitest.setup.ts',
    ],
  },
})
