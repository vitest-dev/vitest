import { defineConfig, mergeConfig } from 'vite'
import defaults from '../../vitest.config'

// https://vitejs.dev/config/
export default mergeConfig(
  defaults,
  defineConfig({
    build: {
      lib: {
        entry: 'src/my-element.ts',
        formats: ['es'],
      },
      rollupOptions: {
        external: /^lit/,
      },
    },
    test: {
      global: true,
      dom: 'happy-dom',
    },
  }),
)
