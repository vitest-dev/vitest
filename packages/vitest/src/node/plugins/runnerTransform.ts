import type { Plugin as VitePlugin } from 'vite'

export function ModuleRunnerTransform(): VitePlugin {
  // make sure Vite always applies the module runner transform
  return {
    name: 'vitest:environments-module-runner',
    config: {
      order: 'post',
      handler(config) {
        config.environments ??= {}

        const names = new Set(Object.keys(config.environments))
        names.add('client')
        names.add('ssr')

        for (const name of names) {
          config.environments[name] ??= {}

          const environment = config.environments[name]
          environment.dev ??= {}
          environment.dev.moduleRunnerTransform = true
          environment.dev.preTransformRequests = false
          environment.keepProcessEnv = true
        }
      },
    },
  }
}
