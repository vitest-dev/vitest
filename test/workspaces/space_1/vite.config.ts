import { defineProject } from 'vitest/config'

export default defineProject({
  define: {
    __DEV__: 'true',
  },
  test: {
    name: 'space_1',
    environment: 'happy-dom',
  },
})
