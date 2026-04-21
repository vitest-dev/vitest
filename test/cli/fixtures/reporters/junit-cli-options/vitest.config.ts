import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    reporters: [
      ['junit', {
        suiteName: 'custom-suite-name',
        addFileAttribute: true,
      }],
    ],
  },
})
