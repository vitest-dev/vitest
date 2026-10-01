import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    diff: {
      // expand: false,
      // printBasicPrototype: false,
    }
  }
})
