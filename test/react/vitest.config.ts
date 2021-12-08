import { defineConfig, mergeConfig } from 'vite'
import defaults from '../../vitest.config'

export default mergeConfig(
  defaults,
  defineConfig({
    test: {
      global: true,
      dom: 'happy-dom',
    },
  }),
)
