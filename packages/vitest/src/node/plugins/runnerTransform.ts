import type { UserConfig, Plugin as VitePlugin } from 'vite'
import { builtinModules } from 'node:module'
import { resolveOptimizerConfig } from './utils'

export function ModuleRunnerTransform(): VitePlugin {
  let testConfig: NonNullable<UserConfig['test']>

  // make sure Vite always applies the module runner transform
  return {
    name: 'vitest:environments-module-runner',
    config: {
      order: 'post',
      handler(config) {
        testConfig = config.test || {}

        // In browser mode the `client` environment serves test code to a real
        // browser via native ESM, so it must NOT be module-runner-transformed.
        // `ssr`/`__vitest__` keep the transform (node-side global setup + watch
        // run there). Note: jsdom/happy-dom (node mode) also uses `client` and
        // DOES need the transform, hence the `browser.enabled` gate.
        const browserEnabled = !!config.test?.browser?.enabled

        config.environments ??= {}

        const names = new Set(Object.keys(config.environments))
        names.add('client')
        names.add('ssr')

        const pool = config.test?.pool
        if (pool === 'vmForks' || pool === 'vmThreads') {
          names.add('__vitest_vm__')
        }

        for (const name of names) {
          config.environments[name] ??= {}

          const environment = config.environments[name]
          environment.dev ??= {}
          // vm tests run using the native import mechanism
          if (name === '__vitest_vm__') {
            environment.dev.moduleRunnerTransform = false
            environment.consumer = 'client'
          }
          else if (name === 'client' && browserEnabled) {
            environment.dev.moduleRunnerTransform = false
          }
          else {
            environment.dev.moduleRunnerTransform = true
          }
          if (name !== 'client' || !browserEnabled) {
            environment.dev.preTransformRequests = false
          }
          environment.keepProcessEnv = true
        }
      },
    },
    configEnvironment: {
      order: 'post',
      handler(name, config) {
        if (name === '__vitest_vm__' || name === '__vitest__') {
          return
        }
        // In browser mode the `client` environment is browser-managed: don't
        // apply node-runner externalization / `optimizeDeps` to it (that would
        // discard the browser `optimizeDeps.include`, e.g. `vitest > expect-type`).
        if (name === 'client' && testConfig.browser?.enabled) {
          return
        }

        config.resolve ??= {}

        // remove Vite's externalization logic because we have our own (unfortunately)
        config.resolve.external = [
          ...builtinModules,
          ...builtinModules
            .filter(m => !m.startsWith('node:'))
            .map(m => `node:${m}`),
        ]

        // by setting `noExternal` to `true`, we make sure that
        // Vite will never use its own externalization mechanism
        // to externalize modules and always resolve static imports
        // in both SSR and Client environments
        config.resolve.noExternal = true

        config.optimizeDeps = resolveOptimizerConfig(
          testConfig?.deps?.optimizer?.[name],
          config.optimizeDeps,
        )
      },
    },
  }
}
