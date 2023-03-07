import { builtinModules } from 'node:module'
import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
import { normalize, relative, resolve } from 'pathe'
import { toArray } from '@vitest/utils'
import { resolveModule } from 'local-pkg'
import { configDefaults } from '../../defaults'
import type { ResolvedConfig, UserConfig } from '../../types'
import { deepMerge, notNullish, removeUndefinedValues } from '../../utils'
import { ensurePackageInstalled } from '../pkg'
import { resolveApiConfig } from '../config'
import { Vitest } from '../core'
import { generateScopedClassName } from '../../integrations/css/css-modules'
import { EnvReplacerPlugin } from './envReplacer'
import { GlobalSetupPlugin } from './globalSetup'
import { MocksPlugin } from './mock'
import { CSSEnablerPlugin } from './cssEnabler'
import { CoverageTransform } from './coverageTransform'

export async function VitestPlugin(options: UserConfig = {}, ctx = new Vitest('test')): Promise<VitePlugin[]> {
  const userConfig = deepMerge({}, options) as UserConfig

  const getRoot = () => ctx.config?.root || options.root || process.cwd()

  async function UIPlugin() {
    await ensurePackageInstalled('@vitest/ui', getRoot())
    return (await import('@vitest/ui')).default(options.uiBase)
  }

  async function BrowserPlugin() {
    await ensurePackageInstalled('@vitest/browser', getRoot())
    return (await import('@vitest/browser')).default('/')
  }

  return [
    <VitePlugin>{
      name: 'vitest',
      enforce: 'pre',
      options() {
        this.meta.watchMode = false
      },
      async config(viteConfig: any) {
        if (options.watch) {
          // Earlier runs have overwritten values of the `options`.
          // Reset it back to initial user config before setting up the server again.
          options = deepMerge({}, userConfig) as UserConfig
        }

        // preliminary merge of options to be able to create server options for vite
        // however to allow vitest plugins to modify vitest config values
        // this is repeated in configResolved where the config is final
        const preOptions = deepMerge(
          {},
          configDefaults,
          options,
          removeUndefinedValues(viteConfig.test ?? {}),
        )
        preOptions.api = resolveApiConfig(preOptions)

        if (viteConfig.define) {
          delete viteConfig.define['import.meta.vitest']
          delete viteConfig.define['process.env']
        }

        // store defines for globalThis to make them
        // reassignable when running in worker in src/runtime/setup.ts
        const defines: Record<string, any> = {}

        for (const key in viteConfig.define) {
          const val = viteConfig.define[key]
          let replacement: any
          try {
            replacement = typeof val === 'string' ? JSON.parse(val) : val
          }
          catch {
            // probably means it contains reference to some variable,
            // like this: "__VAR__": "process.env.VAR"
            continue
          }
          if (key.startsWith('import.meta.env.')) {
            const envKey = key.slice('import.meta.env.'.length)
            process.env[envKey] = replacement
            delete viteConfig.define[key]
          }
          else if (key.startsWith('process.env.')) {
            const envKey = key.slice('process.env.'.length)
            process.env[envKey] = replacement
            delete viteConfig.define[key]
          }
          else if (!key.includes('.')) {
            defines[key] = replacement
            delete viteConfig.define[key]
          }
        }

        (options as ResolvedConfig).defines = defines

        let open: string | boolean | undefined

        if (preOptions.ui && preOptions.open)
          open = preOptions.uiBase ?? '/__vitest__/'
        else if (preOptions.browser)
          open = '/'

        const config: ViteConfig = {
          root: viteConfig.test?.root || options.root,
          esbuild: {
            sourcemap: 'external',

            // Enables using ignore hint for coverage providers with @preserve keyword
            legalComments: 'inline',
          },
          resolve: {
            // by default Vite resolves `module` field, which not always a native ESM module
            // setting this option can bypass that and fallback to cjs version
            mainFields: [],
            alias: preOptions.alias,
            conditions: ['node'],
            // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
            // @ts-ignore we support Vite ^3.0, but browserField is available in Vite ^3.2
            browserField: false,
          },
          server: {
            ...preOptions.api,
            watch: {
              ignored: preOptions.watchExclude,
            },
            open,
            hmr: false,
            preTransformRequests: false,
          },
        }

        const classNameStrategy = preOptions.css && preOptions.css?.modules?.classNameStrategy

        if (classNameStrategy !== 'scoped') {
          config.css ??= {}
          config.css.modules ??= {}
          config.css.modules.generateScopedName = (name: string, filename: string) => {
            const root = getRoot()
            return generateScopedClassName(classNameStrategy, name, relative(root, filename))!
          }
        }

        if (!options.browser) {
          const optimizeConfig: Partial<ViteConfig> = {}
          const optimizer = preOptions.deps?.experimentalOptimizer
          if (!optimizer?.enabled) {
            optimizeConfig.cacheDir = undefined
            optimizeConfig.optimizeDeps = {
              // experimental in Vite >2.9.2, entries remains to help with older versions
              disabled: true,
              entries: [],
            }
          }
          else {
            const root = config.root || process.cwd()
            const [...entries] = await ctx.globAllTestFiles(preOptions as ResolvedConfig, preOptions.dir || root)
            if (preOptions?.setupFiles) {
              const setupFiles = toArray(preOptions.setupFiles).map((file: string) =>
                normalize(
                  resolveModule(file, { paths: [root] })
                    ?? resolve(root, file),
                ),
              )
              entries.push(...setupFiles)
            }
            optimizeConfig.cacheDir = preOptions.cache?.dir ?? 'node_modules/.vitest'
            optimizeConfig.optimizeDeps = {
              ...viteConfig.optimizeDeps,
              ...optimizer,
              disabled: false,
              entries: [...(optimizer.entries || viteConfig.optimizeDeps?.entries || []), ...entries],
              exclude: ['vitest', ...builtinModules, ...(optimizer.exclude || viteConfig.optimizeDeps?.exclude || [])],
              include: (optimizer.include || viteConfig.optimizeDeps?.include || []).filter((n: string) => n !== 'vitest'),
            }
            // Vite throws an error that it cannot rename "deps_temp", but optimization still works
            // let's not show this error to users
            const { error: logError } = console
            console.error = (...args) => {
              if (typeof args[0] === 'string' && args[0].includes('/deps_temp'))
                return
              return logError(...args)
            }
          }
          Object.assign(config, optimizeConfig)
        }

        return config
      },
      async configResolved(viteConfig) {
        const viteConfigTest = (viteConfig.test as any) || {}
        if (viteConfigTest.watch === false)
          viteConfigTest.run = true

        if ('alias' in viteConfigTest)
          delete viteConfigTest.alias

        // viteConfig.test is final now, merge it for real
        options = deepMerge(
          {},
          configDefaults,
          viteConfigTest,
          options,
        )
        options.api = resolveApiConfig(options)

        // we replace every "import.meta.env" with "process.env"
        // to allow reassigning, so we need to put all envs on process.env
        const { PROD, DEV, ...envs } = viteConfig.env

        // process.env can have only string values and will cast string on it if we pass other type,
        // so we are making them truthy
        process.env.PROD ??= PROD ? '1' : ''
        process.env.DEV ??= DEV ? '1' : ''
        process.env.SSR ??= '1'

        for (const name in envs)
          process.env[name] ??= envs[name]

        // don't watch files in run mode
        if (!options.watch) {
          viteConfig.server.watch = {
            persistent: false,
            depth: 0,
            ignored: ['**/*'],
          }
        }
      },
      async configureServer(server) {
        try {
          await ctx.setServer(options, server)
          if (options.api && options.watch)
            (await import('../../api/setup')).setup(ctx)
        }
        catch (err) {
          ctx.logger.printError(err, true)
          process.exit(1)
        }

        // #415, in run mode we don't need the watcher, close it would improve the performance
        if (!options.watch)
          await server.watcher.close()
      },
    },
    EnvReplacerPlugin(),
    MocksPlugin(),
    GlobalSetupPlugin(ctx),
    ...(options.browser
      ? await BrowserPlugin()
      : []),
    ...CSSEnablerPlugin(ctx),
    CoverageTransform(ctx),
    options.ui
      ? await UIPlugin()
      : null,
  ]
    .filter(notNullish)
}
