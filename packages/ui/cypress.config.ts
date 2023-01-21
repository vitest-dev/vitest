import { defineConfig } from 'cypress'
import { resolve } from 'pathe'

export default defineConfig({
  fixturesFolder: false,
  component: {
    specPattern: 'client/**/*.cy.{js,ts,jsx,tsx}',
    devServer: {
      framework: 'vue',
      bundler: 'vite',
      viteConfig: {
        define: {
          'process.env.NODE_DEBUG': '"false"',
        },
        resolve: {
          alias: [
            { find: /^\@vitest\/utils/, replacement: resolve('../utils/src/') },
            { find: /^\@vitest\/runner/, replacement: resolve('../runner/src/') },
          ],
        },
        configFile: resolve('./cypress/vite.config.ts'),
      },
    },
  },
})
