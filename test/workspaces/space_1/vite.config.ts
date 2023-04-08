import { defineWorkspace } from 'vitest/config'

export default defineWorkspace({
  test: {
    name: 'space_1',
    environment: 'happy-dom',
  },
})
