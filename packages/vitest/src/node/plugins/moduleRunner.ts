import type { Plugin as VitePlugin } from 'vite'

export function ModuleRunnerTransform(): VitePlugin {
  // make sure Vite always applies the module runner transform
  return {
    name: 'vitest:environments-module-runner',
    config: {
      order: 'post',
      handler(config) {
        if (!config.environments) {
          config.environments = {
            client: {
              dev: {
                moduleRunnerTransform: true,
                preTransformRequests: false,
              },
            },
          }
          return
        }
        const names = new Set(Object.keys(config.environments))
        names.add('client')
        for (const name of names) {
          config.environments[name] ??= {}

          const environment = config.environments[name]
          environment.dev ??= {}
          environment.dev.moduleRunnerTransform = true
          environment.dev.preTransformRequests = false
          environment.consumer = 'server'
        }
      },
    },
  }
}
