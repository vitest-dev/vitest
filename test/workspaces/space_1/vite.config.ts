import { defineProject } from 'vitest/config'

export default defineProject({
  envPrefix: ['VITE_', 'CUSTOM_'],
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
