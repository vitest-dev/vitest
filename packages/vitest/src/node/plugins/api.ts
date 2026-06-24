import type { Plugin, ServerOptions } from 'vite'
import type { PluginHarness } from '../config/pluginHarness'
import type { ResolvedApiConfig, ResolvedConfig } from '../types/config'
import { defaultBrowserPort, defaultPort } from '../../constants'
import { resolveApiServerConfig } from '../config/resolveConfig'

export function VitestConfigApi(harness: PluginHarness, globalConfig?: ResolvedConfig): Plugin {
  return {
    name: 'vitest:config:api',
    enforce: 'post',
    config: {
      order: 'post',
      handler(viteConfig) {
        // Custom user config, this includes CLI overrides
        const testConfig = viteConfig.test ?? {}
        const isBrowserEnabled = !!testConfig.browser?.enabled

        const api = resolveApiServerConfig(
          testConfig,
          isBrowserEnabled ? defaultBrowserPort : defaultPort,
          harness.logger,
        ) as ResolvedApiConfig
        testConfig.api = api
        if (globalConfig) {
          api.token = globalConfig.api.token
          api.tokenCreated = globalConfig.api.tokenCreated
        }

        const server: ServerOptions = {
          ...api,
          preTransformRequests: false,
          hmr: false,
          open: false,
        }

        const watch = globalConfig?.watch ?? testConfig.watch

        // Disable bultin watch mode if Vitest is not in --watch mode
        if (!watch) {
          server.watch = null
        }
        else {
          server.watch ??= {}
        }

        // Always disable the websocket server in middlewareMode
        if (!isBrowserEnabled && api.middlewareMode) {
          server.ws = false
        }
        else if (viteConfig.server && 'ws' in viteConfig.server) {
          viteConfig.server.ws = undefined
        }

        // chokidar fsevents is unstable on macos when emitting "ready" event
        if (
          process.platform === 'darwin'
          && process.env.VITE_TEST_WATCHER_DEBUG
        ) {
          const watch = server.watch
          if (watch) {
            watch.useFsEvents = false
            watch.usePolling = false
          }
        }

        return {
          server,
        }
      },
    },
  }
}
