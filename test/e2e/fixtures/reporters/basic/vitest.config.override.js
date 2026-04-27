import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    reporters: [
      {
        onInit(vitest) {
          vitest.logger.log('hello from override')
        },
      },
    ],
  },
})