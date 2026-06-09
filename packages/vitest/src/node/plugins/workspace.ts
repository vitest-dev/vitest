import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
import type { PluginHarness } from '../config/pluginHarness'
import type { ResolvedConfig, TestProjectInlineConfiguration, UserConfig } from '../types/config'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, relative, resolve } from 'pathe'
import * as vite from 'vite'
import { generateScopedClassName } from '../../integrations/css/css-modules'
import { createViteLogger, silenceImportViteIgnoreWarning } from '../viteLogger'
import { CoverageTransform } from './coverageTransform'
import { CSSEnablerPlugin } from './cssEnabler'
import { MetaEnvReplacerPlugin } from './metaEnvReplacer'
import { MocksPlugins } from './mocks'
import { NormalizeURLPlugin } from './normalizeURL'
import { VitestOptimizer } from './optimizer'
import { ModuleRunnerTransform } from './runnerTransform'
import {
  deleteDefineConfig,
  getDefaultResolveOptions,
  resolveFsAllow,
} from './utils'
import { VitestProjectResolver } from './vitestResolver'

interface WorkspaceOptions extends TestProjectInlineConfiguration {
  root?: string
  workspacePath: string | number
}

/**
 * Plugins applied when resolving a single project's Vite config.
 *
 * Takes a `Vitest` instance (not a `TestProject` — projects are no longer
 * created during config resolution). The CSS-modules and CSS-enabler hooks
 * fire at file transform time, well after the project's resolved config
 * exists on the Vite resolved config (`viteConfig.test`), so they look up
 * the project's config there lazily.
 *
 * Project filtering (`--project`) is intentionally NOT applied here — it runs
 * at the end of `resolveConfig` so error messages can list every name that was
 * considered (browser-instance and benchmark-derived names included).
 */
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
      config(viteConfig) {
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

        // TODO: globalConfig.inlineConfig (?)
        // if (vitest._cliOptions.benchmarkOnly) {
        //   viteConfig.test.benchmark ??= {}
        //   viteConfig.test.benchmark.enabled = true
        // }

        viteConfig.test?.browser?.instances?.forEach((instance) => {
          // every instance is a potential project — give it a default name
          instance.name ??= name ? `${name} (${instance.browser})` : instance.browser
        })

        const vitestConfig: UserConfig = {
          name: { label: name, color },
        }

        vitestConfig.experimental ??= {}

        // always inherit the global `fsModuleCache` value even without `extends: true`
        if (testConfig.experimental?.fsModuleCache == null && globalConfig.experimental?.fsModuleCache != null) {
          vitestConfig.experimental.fsModuleCache = globalConfig.experimental.fsModuleCache
        }
        if (testConfig.experimental?.fsModuleCachePath == null && globalConfig.experimental?.fsModuleCachePath != null) {
          vitestConfig.experimental.fsModuleCachePath = globalConfig.experimental.fsModuleCachePath
        }
        if (testConfig.experimental?.viteModuleRunner == null && globalConfig.experimental?.viteModuleRunner != null) {
          vitestConfig.experimental.viteModuleRunner = globalConfig.experimental.viteModuleRunner
        }
        if (testConfig.experimental?.nodeLoader == null && globalConfig.experimental?.nodeLoader != null) {
          vitestConfig.experimental.nodeLoader = globalConfig.experimental.nodeLoader
        }
        if (testConfig.experimental?.importDurations == null && globalConfig.experimental?.importDurations != null) {
          vitestConfig.experimental.importDurations = globalConfig.experimental.importDurations
        }

        return {
          base: '/',
          environments: {
            __vitest__: {
              dev: {},
            },
          },
          test: vitestConfig,
        }
      },
    },
    {
      name: 'vitest:project',
      enforce: 'pre',
      options() {
        this.meta.watchMode = false
      },
      config(viteConfig) {
        const originalDefine = { ...viteConfig.define } // stash original defines for browser mode
        const defines: Record<string, any> = deleteDefineConfig(viteConfig)

        const testConfig = viteConfig.test || {}
        const root = testConfig.root || viteConfig.root || options.root

        const resolveOptions = getDefaultResolveOptions()
        let config: ViteConfig = {
          root,
          define: {
            // disable replacing `process.env.NODE_ENV` with static string by vite:client-inject
            'process.env.NODE_ENV': 'process.env.NODE_ENV',
          },
          resolve: {
            ...resolveOptions,
            alias: testConfig.alias,
          },
          server: {
            // disable watch mode in workspaces,
            // because it is handled by the top-level watcher
            watch: null,
            open: false,
            hmr: false,
            ws: false,
            preTransformRequests: false,
            middlewareMode: true,
            fs: {
              allow: resolveFsAllow(
                globalConfig.root,
                globalViteConfig.configFile,
              ),
            },
          },
          // eslint-disable-next-line ts/ban-ts-comment
          // @ts-ignore Vite 6 compat
          environments: {
            ssr: {
              resolve: resolveOptions,
            },
          },
          test: {},
        }

        if ('rolldownVersion' in vite) {
          config = {
            ...config,
            // eslint-disable-next-line ts/ban-ts-comment
            // @ts-ignore rolldown-vite only
            oxc: viteConfig.oxc === false
              ? false
              : {
                  // eslint-disable-next-line ts/ban-ts-comment
                  // @ts-ignore rolldown-vite only
                  target: viteConfig.oxc?.target || 'node18',
                },
          }
        }
        else {
          config = {
            ...config,
            esbuild: viteConfig.esbuild === false
              ? false
              : {
                  // Lowest target Vitest supports is Node18
                  target: viteConfig.esbuild?.target || 'node18',
                  sourcemap: 'external',
                  // Enables using ignore hint for coverage providers with @preserve keyword
                  legalComments: 'inline',
                },
          }
        }

        ;(config.test as ResolvedConfig).defines = defines
        ;(config.test as ResolvedConfig).viteDefine = originalDefine

        const classNameStrategy
          = (typeof testConfig.css !== 'boolean'
            && testConfig.css?.modules?.classNameStrategy)
          || 'stable'

        if (classNameStrategy !== 'scoped') {
          config.css ??= {}
          config.css.modules ??= {}
          if (config.css.modules) {
            config.css.modules.generateScopedName = (
              name: string,
              filename: string,
            ) => {
              // The project's own resolved root (the project's `viteConfig.root`
              // mirrors the resolved Vitest `config.root`). At transform time
              // the resolved viteConfig is available; before then we fall back
              // to the inline `options.root`.
              const projectRoot = root || globalConfig.root
              return generateScopedClassName(
                classNameStrategy,
                name,
                relative(projectRoot, filename),
              )!
            }
          }
        }
        config.customLogger = createViteLogger(
          harness.logger,
          viteConfig.logLevel || 'warn',
          {
            allowClearScreen: false,
          },
        )
        config.customLogger = silenceImportViteIgnoreWarning(config.customLogger)

        return config
      },
    },
    // TODO
    // {
    //   name: 'vitest:project:server',
    //   enforce: 'pre',
    //   configureServer: {
    //     // Install Vitest's `ServerModuleRunner` on the project's SSR
    //     // environment so user plugins' `configureServer` hooks can use
    //     // `server.environments.ssr.runner.import(...)` and get the runner
    //     // that respects Vitest's external/noExternal semantics.
    //     order: 'pre',
    //     async handler(server) {
    //       const { ServerModuleRunner } = await import('../environments/serverRunner')
    //       const { isRunnableDevEnvironment } = await import('vite')
    //       const ssrEnvironment = server.environments.ssr
    //       if (isRunnableDevEnvironment(ssrEnvironment)) {
    //         const ssrRunner = new ServerModuleRunner(
    //           ssrEnvironment,
    //           vitest._fetcher,
    //           vitest.config,
    //         )
    //         Object.defineProperty(ssrEnvironment, 'runner', {
    //           value: ssrRunner,
    //           writable: true,
    //           configurable: true,
    //         })
    //       }
    //     },
    //   },
    // },
    MetaEnvReplacerPlugin(),
    // TODO: should be testProject's config
    ...CSSEnablerPlugin({ config: globalConfig }),
    CoverageTransform(harness),
    ...MocksPlugins(),
    VitestProjectResolver(harness),
    VitestOptimizer(),
    NormalizeURLPlugin(),
    ModuleRunnerTransform(),
  ]
}
