import type { Plugin as VitePlugin } from 'vite'
import { builtinModules } from 'node:module'
import { resolveOptimizerConfig } from './utils'

export function ModuleRunnerTransform(): VitePlugin {
  // make sure Vite always applies the module runner transform
  return {
    name: 'vitest:environments-module-runner',
    config: {
      order: 'post',
      handler(config) {
        const testConfig = config.test || {}

        config.environments ??= {}

        const names = new Set(Object.keys(config.environments))
        names.add('client')
        names.add('ssr')

        // TODO: is it possible to define a pool after the hook? is it passed down if the config is inline project?
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
          else {
            environment.dev.moduleRunnerTransform = true
          }
          environment.dev.preTransformRequests = false
          environment.keepProcessEnv = true

          const currentOptimizeDeps = environment.optimizeDeps || (
            name === 'client'
              ? config.optimizeDeps
              : name === 'ssr'
                ? config.ssr?.optimizeDeps
                : undefined
          )

          const optimizeDeps = resolveOptimizerConfig(
            testConfig.deps?.optimizer?.[name],
            currentOptimizeDeps,
          )
          environment.optimizeDeps = optimizeDeps

          // remove Vite's externalization logic because we have our own (unfortunetly)
          environment.resolve ??= {}

          // TODO: make sure we copy user settings to server.deps.inline/server.deps.external
          environment.resolve.external = [
            ...builtinModules,
            ...builtinModules.map(m => `node:${m}`),
          ]
          // by setting `noExternal` to `true`, we make sure that
          // Vite will never use its own externalization mechanism
          // to externalize modules and always resolve static imports
          // in both SSR and Client environments
          environment.resolve.noExternal = true
        }
      },
    },
  }
}
