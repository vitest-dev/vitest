import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    {
      name: 'throw-error',
      config() {
        throw new Error('This file should not initiate a workspace project.')
      },
    },
  ],
})
