import type { Plugin } from 'vite'
import type { PluginHarness } from '../config/pluginHarness'
import { installSsrModuleRunner } from '../environments/serverRunner'

// Runs `pre` so it sits before user plugins, whose `configureServer` hooks may
// rely on `server.environments.ssr.runner` being Vitest's module runner.
export function SsrRunnerFixerPlugin(harness: PluginHarness): Plugin {
  return {
    name: 'vitest:ssr-module-runner-fixer',
    enforce: 'pre',
    configureServer: {
      order: 'pre',
      handler(server) {
        const vitest = harness.getVitest()
        installSsrModuleRunner(server, vitest._fetcher, vitest.config)
      },
    },
  }
}
