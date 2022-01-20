import path from 'path'
import { startDevServer } from '@cypress/vite-dev-server'

const plugin: Cypress.PluginConfig = (on, config) => {
  on('dev-server:start', options => startDevServer({
    options,
    viteConfig: {
      configFile: path.resolve(__dirname, './vite.config.ts'),
    },
  }))

  return config
}

export default plugin
