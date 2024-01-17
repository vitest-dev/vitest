import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    poolOptions: {
      threads: {
        execArgv: ['--experimental-network-imports'],
      },
    },
    // let vite serve public/slash@3.0.0.js
    api: 9602,
  },
})
