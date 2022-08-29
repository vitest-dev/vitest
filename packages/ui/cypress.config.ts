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
        configFile: resolve('./cypress/vite.config.ts'),
      },
    },
  },
})
