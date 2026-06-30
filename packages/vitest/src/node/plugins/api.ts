import type { Plugin, ServerOptions } from 'vite'
import type { PluginHarness } from '../config/pluginHarness'
import type { ResolvedApiConfig, ResolvedConfig } from '../types/config'
import { defaultPort } from '../../constants'
import { resolveApiServerConfig } from '../config/resolveConfig'

export function VitestConfigApi(harness: PluginHarness, globalConfig?: ResolvedConfig): Plugin {
  return {
    name: 'vitest:config:api',
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
          preTransformRequests: false,
          hmr: false,
          open: false,
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
    configResolved: {
      order: 'post',
      handler(viteConfig) {
        // The watcher is set on the resolved config directly because returning
        // `watch: null` from the `config` hook is a no-op: Vite's config merge
        // drops `null` overrides, so a user-provided `server.watch` object wins.
        const server = viteConfig.server
        const watch = globalConfig?.watch ?? viteConfig.test?.watch
        if (!watch) {
          // disable the builtin watcher when Vitest is not in --watch mode
          server.watch = null
        }
        else {
          server.watch ??= {}
          // chokidar fsevents is unstable on macos when emitting "ready" event
          if (process.platform === 'darwin' && process.env.VITE_TEST_WATCHER_DEBUG) {
            server.watch.useFsEvents = false
            server.watch.usePolling = false
          }
        }
      },
    },
  }
}
