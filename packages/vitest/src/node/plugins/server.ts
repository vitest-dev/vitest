import type { Plugin, ServerOptions } from 'vite'
import type { PluginHarness } from '../config/pluginHarness'
import type { ResolvedApiConfig, ResolvedConfig } from '../types/config'
import { defaultPort } from '../../constants'
import { resolveApiServerConfig } from '../config/resolveConfig'

export function VitestConfigServer(harness: PluginHarness, globalConfig?: ResolvedConfig): Plugin[] {
  return [
    {
      name: 'vitest:config:server-defaults',
      config: {
        // These static server toggles must be visible to other plugins that
        // read `server.hmr` in their own `config` hook — e.g.
        // `@vitejs/plugin-react` turns React Fast Refresh off only when it sees
        // HMR disabled. A `post` hook (below) runs after such plugins, so set
        // them here in a `pre` hook instead.
        order: 'pre',
        handler() {
          return {
            server: {
              hmr: false,
              open: false,
            },
          }
        },
      },
    },
    {
      name: 'vitest:config:server',
      enforce: 'post',
      config: {
        order: 'post',
        handler(viteConfig) {
          // Custom user config, this plugin already received CLI overrides
          const testConfig = viteConfig.test ?? {}
          const isBrowserEnabled = !!testConfig.browser?.enabled

          const api = resolveApiServerConfig(
            testConfig,
            isBrowserEnabled ? harness._browserLastPort++ : defaultPort,
            harness.logger,
          ) as ResolvedApiConfig
          testConfig.api = api
          if (globalConfig) {
            api.token = globalConfig.api.token
            api.tokenCreated = globalConfig.api.tokenCreated
          }

          const server: ServerOptions = {
            ...api,
          }
          if (!isBrowserEnabled) {
            server.preTransformRequests = false
          }

          // Always disable the websocket server in middlewareMode
          if (!isBrowserEnabled && api.middlewareMode) {
            server.ws = false
          }
          else if (viteConfig.server && 'ws' in viteConfig.server) {
            viteConfig.server.ws = undefined
          }

          return {
            server,
          }
        },
      },
    },
  ]
}
