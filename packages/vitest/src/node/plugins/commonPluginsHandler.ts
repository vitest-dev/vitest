import type { Plugin } from 'vite'
import { resolve } from 'pathe'
import { hasVitePlugin } from '../../utils/config-helpers'
import { distDir } from '../../paths'

export function CommonPluginsHandler(): Plugin {
  return {
    name: 'vitest:common-plugins-enforcer',
    enforce: 'post',
    config: {
      order: 'post',
      async handler(config) {
        const plugins = (config.plugins || [])
        const hasReact = await hasVitePlugin(plugins, 'vite:react-babel')
        if (hasReact) {
          return {
            test: {
              deps: {
                inline: [/vitest\/setup\/react-refresh.js/],
              },
              // Since this is an official plugin, it should be OK to inline reac-refresh HRM logic
              setupFiles: [resolve(distDir, '../setup/react-refresh.js')],
            },
          }
        }
      },
    },
  }
}
