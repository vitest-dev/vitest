import type { ConfigEnv, ResolveOptions, Plugin as VitePlugin, UserConfig as ViteUserConfig } from 'vite'
import type { PluginHarness } from '../config/pluginHarness'
import type { ResolvedBrowserOptions } from '../types/browser'
import type {
  ConfigResolutionCaptures,
  InlineConfig,
  ModuleRunnerTestOptions,
  ResolvedApiConfig,
  ResolvedConfig,
  UserConfig,
} from '../types/config'
import { deepMerge } from '@vitest/utils/helpers'
import { normalize } from 'pathe'
import { mergeConfig } from 'vite'
import { defaultPort } from '../../constants'
import { escapeRegExp } from '../../utils/base'
import { resolveApiServerConfig } from '../config/resolveConfig'
import { deleteDefineConfig } from './utils'

// `name` must stay unique per project, `projects` would redefine the whole workspace
const NON_INHERITED_OPTIONS = ['name', 'projects'] as const

// the root `globalSetup` already runs once per test run; a non-root
// config (a shared config or a container) keeps it because nothing else runs it
const NON_INHERITED_ROOT_OPTIONS = [...NON_INHERITED_OPTIONS, 'globalSetup'] as const

interface TestConfigProjectContext {
  options: { test?: UserConfig }
  extendsTrueRootConfig: boolean
}

interface SharedServerOptions {
  defines: ResolvedConfig['defines']
  scriptDefines: Record<string, any> | undefined
  moduleRunnerOptions: ModuleRunnerTestOptions | undefined
}

/**
 * Every plugin that modifies the `test` config during Vite config resolution.
 * Projects that share the declaring config's Vite server run the same hooks
 * through `resolveTestOptions` instead of resolving through Vite.
 *
 * `project` is only set for inline projects that extend another config.
 * `sharedServer` is only set by `resolveTestOptions`: it carries the values
 * that are normally derived from the resolving config's Vite options, which
 * a shared server resolved once for its whole cluster.
 */
export function TestConfigPlugin(
  harness: PluginHarness,
  captures: ConfigResolutionCaptures,
  cliOptions: UserConfig,
  globalConfig?: ResolvedConfig,
  project?: TestConfigProjectContext,
  sharedServer?: SharedServerOptions,
): VitePlugin[] {
  let testConfig: InlineConfig
  const noExternal: (string | RegExp)[] = []
  const external: (string | RegExp)[] = []
  let noExternalAll = false

  return [
    {
      // The CLI plugin overwrites config values with CLI options, making them
      // available in the next plugin. We have to do this via plugins because of watch mode.
      name: 'vitest:config:cli',
      enforce: 'pre',
      config: {
        order: 'pre',
        handler(config) {
          const { browser, ...options } = cliOptions

          // We don't want to use Vite's merge because we want to OVERRIDE options
          // By default, Vite extends arrays, for example, but CLI options should have the priority
          config.test = deepMerge({}, config.test ?? {}, options)

          // apply browser CLI options only if the config already has the browser config and not disabled manually
          if (config.test.browser && browser && (config.test.browser.enabled !== false || browser.enabled)) {
            config.test.browser = mergeConfig(
              config.test.browser,
              browser,
            ) as ResolvedBrowserOptions
          }

          // an extending project removes the non-inherited values it doesn't
          // define itself before any other `config` hook can set them
          if (!project) {
            return
          }
          // the project's own `tags` replace the inherited array so tags can be overridden
          if (project.options.test?.tags) {
            config.test.tags = project.options.test.tags
          }
          const nonInheritedOptions = project.extendsTrueRootConfig
            ? NON_INHERITED_ROOT_OPTIONS
            : NON_INHERITED_OPTIONS
          for (const key of nonInheritedOptions) {
            if (project.options.test?.[key] !== undefined) {
              (config.test as any)[key] = project.options.test[key]
            }
            else {
              delete config.test[key]
            }
          }
        },
      },
    },
    {
      name: 'vitest:test-config',
      config: {
        order: 'post',
        handler(config) {
          config.test ??= {}
          testConfig = config.test

          const moduleDirectories = testConfig.deps?.moduleDirectories || []

          const envModuleDirectories
            = process.env.VITEST_MODULE_DIRECTORIES
              || process.env.npm_config_VITEST_MODULE_DIRECTORIES

          if (envModuleDirectories) {
            moduleDirectories.push(...envModuleDirectories.split(','))
          }

          const normalized = moduleDirectories.map(
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
          if (!normalized.includes('/node_modules/')) {
            normalized.push('/node_modules/')
          }

          testConfig.deps ??= {}
          testConfig.deps.moduleDirectories = normalized

          const isBrowserEnabled = !!testConfig.browser?.enabled

          if (config.define) {
            delete config.define['import.meta.vitest']
          }
          // We inject the defines at runtime in non-browser tests,
          // but keep the original behaviour in the browser mode
          const resolvedTestConfig = testConfig as ResolvedConfig
          if (sharedServer) {
            resolvedTestConfig.defines = sharedServer.defines
            resolvedTestConfig._scriptDefines = sharedServer.scriptDefines
          }
          else if (isBrowserEnabled) {
            resolvedTestConfig.defines = config.define || {}
          }
          else {
            const { defines, scriptDefines } = deleteDefineConfig(config)
            resolvedTestConfig.defines = defines
            resolvedTestConfig._scriptDefines = scriptDefines
          }

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
        },
      },
      configEnvironment: {
        order: 'post',
        handler(name, config) {
          if (name === '__vitest_vm__' || name === '__vitest__') {
            return
          }
          // In browser mode the `client` environment is browser-managed
          if (name === 'client' && testConfig.browser?.enabled) {
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
        },
      },
      configResolved: {
        order: 'pre',
        handler(config) {
          const options = sharedServer?.moduleRunnerOptions
            ?? { inlineAll: noExternalAll, inline: noExternal, external }
          captures.moduleRunnerOptions = options

          const testConfig = config.test!
          testConfig.server ??= {}
          testConfig.server.deps ??= {}

          if (testConfig.server.deps.inline !== true) {
            if (options.inlineAll) {
              testConfig.server.deps.inline = true
            }
            else if (options.inline.length) {
              testConfig.server.deps.inline ??= []
              testConfig.server.deps.inline.push(...options.inline)
            }
          }
          if (options.external.length) {
            testConfig.server.deps.external ??= []
            testConfig.server.deps.external.push(...options.external)
          }
        },
      },
    },
  ]
}

interface SharedServerTestOptionsContext {
  harness: PluginHarness
  cliOptions: UserConfig
  globalConfig: ResolvedConfig
  project: TestConfigProjectContext
  sharedServer: SharedServerOptions
}

/**
 * Applies the `test` mutations of `TestConfigPlugin` to a project that shares
 * the declaring config's Vite server: the same hooks run on a bare config
 * object instead of going through Vite's resolution.
 */
export function resolveTestOptions(
  test: UserConfig,
  context: SharedServerTestOptionsContext,
): UserConfig {
  const viteConfig: ViteUserConfig = { test }
  const plugins = TestConfigPlugin(
    context.harness,
    {},
    context.cliOptions,
    context.globalConfig,
    context.project,
    context.sharedServer,
  )
  const env: ConfigEnv = { command: 'serve', mode: test.mode || 'test' }
  for (const plugin of plugins) {
    const config = plugin.config as { handler: (config: ViteUserConfig, env: ConfigEnv) => unknown } | undefined
    config?.handler(viteConfig, env)
    // `configEnvironment` never runs: there are no environments to resolve,
    // `sharedServerOptions` carries what they contributed on the shared server
    const configResolved = plugin.configResolved as { handler: (config: unknown) => void } | undefined
    configResolved?.handler(viteConfig)
  }
  return viteConfig.test!
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
