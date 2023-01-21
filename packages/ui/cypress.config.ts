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
          alias: {
            '@vitest/runner/utils': resolve('../runner/src/utils.ts'),
          },
        },
        configFile: resolve('./cypress/vite.config.ts'),
      },
    },
  },
})
