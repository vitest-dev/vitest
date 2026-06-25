import type * as vite from 'vite'
import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
import type { PluginHarness } from '../config/pluginHarness'
import type { ResolvedConfig, TestProjectInlineConfiguration } from '../types/config'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'pathe'
import { isRunnableDevEnvironment } from 'vite'
import { API_TOKEN_FILE } from '../config/apiToken'
import { ServerModuleRunner } from '../environments/serverRunner'
import { VitestConfigApi } from './api'
import { VitestConfig } from './config'
import { CoverageTransform } from './coverageTransform'
import { CSSEnablerPlugin } from './cssEnabler'
import { MetaEnvReplacerPlugin } from './metaEnvReplacer'
import { MocksPlugins } from './mocks'
import { NormalizeURLPlugin } from './normalizeURL'
import { VitestProjectResolver } from './vitestResolver'

interface WorkspaceOptions extends TestProjectInlineConfiguration {
  root?: string
  workspacePath: string | number
}

export function WorkspaceVitestPlugin(
  harness: PluginHarness,
  globalViteConfig: vite.ResolvedConfig,
  globalConfig: ResolvedConfig,
  options: WorkspaceOptions,
): VitePlugin[] {
  return [
    {
      name: 'vitest:project:name',
      enforce: 'post',
      config: {
        order: 'post',
        handler(viteConfig) {
          viteConfig.test ??= {}

          const testConfig = viteConfig.test

          let { label: name, color } = typeof testConfig.name === 'string'
            ? { label: testConfig.name }
            : { label: '', ...testConfig.name }

          if (!name) {
            if (typeof options.workspacePath === 'string') {
            // if there is a package.json, read the name from it
              const dir = options.workspacePath.endsWith('/')
                ? options.workspacePath.slice(0, -1)
                : dirname(options.workspacePath)
              const pkgJsonPath = resolve(dir, 'package.json')
              if (existsSync(pkgJsonPath)) {
                name = JSON.parse(readFileSync(pkgJsonPath, 'utf-8')).name
              }
              if (typeof name !== 'string' || !name) {
                name = basename(dir)
              }
            }
            else {
              name = options.workspacePath.toString()
            }
          }

          if (globalConfig.cliOptions.benchmarkOnly) {
            viteConfig.test.benchmark ??= {}
            viteConfig.test.benchmark.enabled = true
          }

          viteConfig.test.browser?.instances?.forEach((instance) => {
          // every instance is a potential project — give it a default name
            instance.name ??= name ? `${name} (${instance.browser})` : instance.browser
          })

          return {
            test: {
              name: { label: name, color },
            },
          }
        },
      },
    },
    {
      name: 'vitest:project',
      enforce: 'post',
      options() {
        this.meta.watchMode = false
      },
      config(viteConfig) {
        const testConfig = viteConfig.test || {}
        const root = options.root || testConfig.root || viteConfig.root

        const config: ViteConfig = {
          base: '/',
          root,
          server: {
            // disable watch mode in projects because it is handled by the top-level watcher
            watch: null,
            open: false,
            fs: {
              allow: globalViteConfig.server.fs.allow,
              deny: [API_TOKEN_FILE],
            },
          },
        }

        testConfig.experimental ??= {}

        // always inherit the global `fsModuleCache` value even without `extends: true`
        if (testConfig.experimental?.fsModuleCache == null && globalConfig.experimental?.fsModuleCache != null) {
          testConfig.experimental.fsModuleCache = globalConfig.experimental.fsModuleCache
        }
        if (testConfig.experimental?.fsModuleCachePath == null && globalConfig.experimental?.fsModuleCachePath != null) {
          testConfig.experimental.fsModuleCachePath = globalConfig.experimental.fsModuleCachePath
        }
        if (testConfig.experimental?.viteModuleRunner == null && globalConfig.experimental?.viteModuleRunner != null) {
          testConfig.experimental.viteModuleRunner = globalConfig.experimental.viteModuleRunner
        }
        if (testConfig.experimental?.nodeLoader == null && globalConfig.experimental?.nodeLoader != null) {
          testConfig.experimental.nodeLoader = globalConfig.experimental.nodeLoader
        }
        if (testConfig.experimental?.importDurations == null && globalConfig.experimental?.importDurations != null) {
          testConfig.experimental.importDurations = globalConfig.experimental.importDurations
        }

        return config
      },
      configResolved(config) {
        // Projects always inherit non-project config options
        config.test.coverage = globalConfig.coverage
        config.test.attachmentsDir = globalConfig.attachmentsDir
      },
    },
    VitestConfigApi(harness, globalConfig),
    {
      name: 'vitest:project:server',
      enforce: 'pre',
      configureServer: {
        // Install Vitest's `ServerModuleRunner` on the project's SSR
        // environment so user plugins' `configureServer` hooks can use
        // `server.environments.ssr.runner.import(...)` and get the runner
        // that respects Vitest's external/noExternal semantics.
        order: 'pre',
        async handler(server) {
          const ssrEnvironment = server.environments.ssr
          if (isRunnableDevEnvironment(ssrEnvironment)) {
            const vitest = harness.getVitest()
            const ssrRunner = new ServerModuleRunner(
              ssrEnvironment,
              vitest._fetcher,
              vitest.config,
            )
            Object.defineProperty(ssrEnvironment, 'runner', {
              value: ssrRunner,
              writable: true,
              configurable: true,
            })
          }
        },
      },
    },
    MetaEnvReplacerPlugin(),
    // TODO: should be testProject's config
    ...CSSEnablerPlugin({ config: globalConfig }),
    CoverageTransform(harness),
    ...VitestConfig(harness),
    ...MocksPlugins(),
    VitestProjectResolver(harness),
    NormalizeURLPlugin(),
  ]
}
