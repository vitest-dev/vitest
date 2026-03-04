import type { ResolveOptions, UserConfig, Plugin as VitePlugin } from 'vite'
import { builtinModules } from 'node:module'
import { normalize } from 'pathe'
import { escapeRegExp } from '../../utils/base'
import { resolveOptimizerConfig } from './utils'

export function ModuleRunnerTransform(): VitePlugin {
  let testConfig: NonNullable<UserConfig['test']>
  const noExternal: (string | RegExp)[] = []
  const external: (string | RegExp)[] = []
  let noExternalAll = false

  // make sure Vite always applies the module runner transform
  return {
    name: 'vitest:environments-module-runner',
    config: {
      order: 'post',
      handler(config) {
        testConfig = config.test || {}

        config.environments ??= {}

        const names = new Set(Object.keys(config.environments))
        names.add('client')
        names.add('ssr')

        const pool = config.test?.pool
        if (pool === 'vmForks' || pool === 'vmThreads') {
          names.add('__vitest_vm__')
        }

        let moduleDirectories = testConfig.deps?.moduleDirectories || []

        const envModuleDirectories
          = process.env.VITEST_MODULE_DIRECTORIES
            || process.env.npm_config_VITEST_MODULE_DIRECTORIES

        if (envModuleDirectories) {
          moduleDirectories.push(...envModuleDirectories.split(','))
        }

        moduleDirectories = moduleDirectories.map(
          (dir) => {
            if (dir[0] !== '/') {
              dir = `/${dir}`
            }
            if (!dir.endsWith('/')) {
              dir += '/'
            }
            return normalize(dir)
          },
        )
        if (!moduleDirectories.includes('/node_modules/')) {
          moduleDirectories.push('/node_modules/')
        }

        testConfig.deps ??= {}
        testConfig.deps.moduleDirectories = moduleDirectories

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
        }
      },
    },
    configEnvironment: {
      order: 'post',
      handler(name, config) {
        if (name === '__vitest_vm__' || name === '__vitest__') {
          return
        }

        config.resolve ??= {}
        const envNoExternal = resolveViteResolveOptions('noExternal', config.resolve, testConfig.deps?.moduleDirectories)
        if (envNoExternal === true) {
          noExternalAll = true
        }
        else if (envNoExternal.length) {
          noExternal.push(...envNoExternal)
        }

        const envExternal = resolveViteResolveOptions('external', config.resolve, testConfig.deps?.moduleDirectories)
        if (envExternal !== true && envExternal.length) {
          external.push(...envExternal)
        }

        // remove Vite's externalization logic because we have our own (unfortunately)
        config.resolve.external = [
          ...builtinModules,
          ...builtinModules.map(m => `node:${m}`),
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
    configResolved: {
      order: 'pre',
      handler(config) {
        const testConfig = config.test!
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
  options: Pick<ResolveOptions, 'noExternal' | 'external'>,
  moduleDirectories: string[] | undefined,
): true | (string | RegExp)[] {
  if (Array.isArray(options[key])) {
    // mergeConfig will merge a custom `true` into an array
    if (options[key].some(p => (p as any) === true)) {
      return true
    }
    return options[key].map(dep => processWildcard(dep, moduleDirectories))
  }
  else if (
    typeof options[key] === 'string'
    || options[key] instanceof RegExp
  ) {
    return [options[key]].map(dep => processWildcard(dep, moduleDirectories))
  }
  else if (typeof options[key] === 'boolean') {
    return true
  }
  return []
}

function processWildcard(dep: string | RegExp, moduleDirectories: string[] | undefined) {
  if (typeof dep !== 'string') {
    return dep
  }
  if (typeof dep === 'string' && dep.includes('*')) {
    const directories = (moduleDirectories || ['/node_modules/']).map(r => escapeRegExp(r))
    return new RegExp(
      `(${directories.join('|')})${dep.replace(/\*/g, '[\\w/]+')}`,
    )
  }
  return dep
}
