import { defineProject } from 'vitest/config'
import { cwdPlugin } from '../cwdPlugin'

export default defineProject({
  envPrefix: ['VITE_', 'CUSTOM_'],
  plugins: [cwdPlugin('SPACE_2')],
  define: {
    __DEV__: 'true',
  },
  test: {
    name: 'space_1',
    environment: 'happy-dom',
    env: {
      CONFIG_LOCAL: 'local',
      CONFIG_OVERRIDE: 'local',
    },
  },
})
