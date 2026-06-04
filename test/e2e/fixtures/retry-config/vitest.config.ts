import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    retry: {
      count: 3,
      // @ts-expect-error
      condition: () => true
    }
  }
})
