import type { Environment } from '../types'

export default <Environment>({
  name: 'node',
  async setup() {
    return {
      teardown() {
      },
    }
  },
})
