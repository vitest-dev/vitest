import { resolve } from 'pathe'
import { startDevServer } from '@cypress/vite-dev-server'

const plugin: Cypress.PluginConfig = (on, config) => {
  on('dev-server:start', options => startDevServer({
    options,
    viteConfig: {
      configFile: resolve(__dirname, './vite.config.ts'),
    },
  }))

  return config
}

export default plugin
