import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    // threads: false,
    deps: {
      inline: [
        'history',
      ],
    },
  },
})
