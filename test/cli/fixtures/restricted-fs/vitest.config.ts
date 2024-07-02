import { resolve } from 'pathe'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    {
      // simulates restrictive FS
      name: 'restrict-fs',
      config() {
        return {
          server: {
            fs: {
              allow: [
                resolve(__dirname, 'src'),
              ],
            },
          },
        }
      },
    },
  ],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.spec.{js,ts}'],
    setupFiles: [
      './vitest.setup.js',
    ],
  },
})
