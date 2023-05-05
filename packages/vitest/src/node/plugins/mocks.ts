import type { Plugin } from 'vite'
import { hoistMocks } from '../hoistMocks'

export function MocksPlugin(): Plugin {
  const plugin: Plugin = {
    name: 'vitest:mocks',
    enforce: 'post',
    transform(code, id) {
      return hoistMocks(code, id, this.parse)
    },
    configResolved(config: any) {
      const pluginIndex = config.plugins.indexOf(plugin)
      const [mocksPlugin] = config.plugins.splice(pluginIndex, 1)
      // inject before import-analysis
      config.plugins.splice(config.plugins.length - 1, 0, mocksPlugin)
    },
  }

  return plugin
}
