import type { Environment } from 'vitest/runtime'

export default <Environment>{
  name: 'custom',
  viteEnvironment: 'ssr',
  setup() {
    return {
      teardown() {},
    }
  },
}
