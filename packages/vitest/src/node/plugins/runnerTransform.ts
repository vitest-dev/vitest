import type { ResolvedConfig, UserConfig, Plugin as VitePlugin } from 'vite'
import { builtinModules } from 'node:module'
import { mergeConfig } from 'vite'
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

        const pool = config.test?.pool
        if (pool === 'vmForks' || pool === 'vmThreads') {
          names.add('__vitest_vm__')
        }

        const external: (string | RegExp)[] = []
        const noExternal: (string | RegExp)[] = []

        let noExternalAll: true | undefined

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

          const resolveExternal = name === 'client'
            ? config.resolve?.external
            : []
          const resolveNoExternal = name === 'client'
            ? config.resolve?.noExternal
            : []

          const topLevelResolveOptions: UserConfig['resolve'] = {}
          if (resolveExternal != null) {
            topLevelResolveOptions.external = resolveExternal
          }
          if (resolveNoExternal != null) {
            topLevelResolveOptions.noExternal = resolveNoExternal
          }

          const currentResolveOptions = mergeConfig(
            topLevelResolveOptions,
            environment.resolve || {},
          ) as ResolvedConfig['resolve']

          const envNoExternal = resolveViteResolveOptions('noExternal', currentResolveOptions)
          if (envNoExternal === true) {
            noExternalAll = true
          }
          else {
            noExternal.push(...envNoExternal)
          }

          const envExternal = resolveViteResolveOptions('external', currentResolveOptions)
          if (envExternal !== true) {
            external.push(...envExternal)
          }

          // remove Vite's externalization logic because we have our own (unfortunetly)
          environment.resolve ??= {}

          environment.resolve.external = [
            ...builtinModules,
            ...builtinModules.map(m => `node:${m}`),
          ]
          // by setting `noExternal` to `true`, we make sure that
          // Vite will never use its own externalization mechanism
          // to externalize modules and always resolve static imports
          // in both SSR and Client environments
          environment.resolve.noExternal = true

          if (name === '__vitest_vm__' || name === '__vitest__') {
            continue
          }

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

          // Vite respects the root level optimize deps, so we override it instead
          if (name === 'client') {
            config.optimizeDeps = optimizeDeps
            environment.optimizeDeps = undefined
          }
          else if (name === 'ssr') {
            config.ssr ??= {}
            config.ssr.optimizeDeps = optimizeDeps
            environment.optimizeDeps = undefined
          }
          else {
            environment.optimizeDeps = optimizeDeps
          }
        }

        testConfig.server ??= {}
        testConfig.server.deps ??= {}

        if (testConfig.server.deps.inline !== true) {
          if (noExternalAll) {
            testConfig.server.deps.inline = true
          }
          else if (noExternal.length) {
            testConfig.server.deps.inline ??= []
            testConfig.server.deps.inline.push(...noExternal)
          }
        }
        if (external.length) {
          testConfig.server.deps.external ??= []
          testConfig.server.deps.external.push(...external)
        }
      },
    },
  }
}

function resolveViteResolveOptions(
  key: 'noExternal' | 'external',
  options: ResolvedConfig['resolve'],
): true | (string | RegExp)[] {
  if (Array.isArray(options[key])) {
    return options[key]
  }
  else if (
    typeof options[key] === 'string'
    || options[key] instanceof RegExp
  ) {
    return [options[key]]
  }
  else if (typeof options[key] === 'boolean') {
    return true
  }
  return []
}
