import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
import type { TestProject } from '../project'
import type { ResolvedConfig, UserWorkspaceConfig } from '../types/config'
import { existsSync, readFileSync } from 'node:fs'
import { deepMerge } from '@vitest/utils'
import { basename, dirname, relative, resolve } from 'pathe'
import { configDefaults } from '../../defaults'
import { generateScopedClassName } from '../../integrations/css/css-modules'
import { createViteLogger, silenceImportViteIgnoreWarning } from '../viteLogger'
import { getDefaultServerConditions } from './conditions'
import { CoverageTransform } from './coverageTransform'
import { CSSEnablerPlugin } from './cssEnabler'
import { MocksPlugins } from './mocks'
import { NormalizeURLPlugin } from './normalizeURL'
import { VitestOptimizer } from './optimizer'
import { SsrReplacerPlugin } from './ssrReplacer'
import {
  deleteDefineConfig,
  hijackVitePluginInject,
  resolveFsAllow,
} from './utils'
import { VitestProjectResolver } from './vitestResolver'

interface WorkspaceOptions extends UserWorkspaceConfig {
  root?: string
  workspacePath: string | number
}

export function WorkspaceVitestPlugin(
  project: TestProject,
  options: WorkspaceOptions,
) {
  return <VitePlugin[]>[
    {
      name: 'vitest:project',
      enforce: 'pre',
      options() {
        this.meta.watchMode = false
      },
      config(viteConfig) {
        const defines: Record<string, any> = deleteDefineConfig(viteConfig)

        const testConfig = viteConfig.test || {}

        const root = testConfig.root || viteConfig.root || options.root
        let name = testConfig.name
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

        const conditions = getDefaultServerConditions()

        const config: ViteConfig = {
          root,
          resolve: {
            // by default Vite resolves `module` field, which not always a native ESM module
            // setting this option can bypass that and fallback to cjs version
            mainFields: [],
            alias: testConfig.alias,
            conditions,
          },
          esbuild: viteConfig.esbuild === false
            ? false
            : {
                // Lowest target Vitest supports is Node18
                target: viteConfig.esbuild?.target || 'node18',
                sourcemap: 'external',
                // Enables using ignore hint for coverage providers with @preserve keyword
                legalComments: 'inline',
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
                project.vitest.config.root,
                project.vitest.server.config.configFile,
              ),
            },
          },
          // eslint-disable-next-line ts/ban-ts-comment
          // @ts-ignore Vite 6 compat
          environments: {
            ssr: {
              resolve: {
                // by default Vite resolves `module` field, which not always a native ESM module
                // setting this option can bypass that and fallback to cjs version
                mainFields: [],
                conditions,
              },
            },
          },
          test: {
            name,
          },
        };

        (config.test as ResolvedConfig).defines = defines

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
              const root = project.config.root
              return generateScopedClassName(
                classNameStrategy,
                name,
                relative(root, filename),
              )!
            }
          }
        }
        config.customLogger = createViteLogger(
          project.logger,
          viteConfig.logLevel || 'warn',
          {
            allowClearScreen: false,
          },
        )
        config.customLogger = silenceImportViteIgnoreWarning(config.customLogger)

        return config
      },
      configResolved(viteConfig) {
        hijackVitePluginInject(viteConfig)
      },
      async configureServer(server) {
        const options = deepMerge({}, configDefaults, server.config.test || {})
        await project._configureServer(options, server)

        await server.watcher.close()
      },
    },
    SsrReplacerPlugin(),
    ...CSSEnablerPlugin(project),
    CoverageTransform(project.ctx),
    ...MocksPlugins(),
    VitestProjectResolver(project.ctx),
    VitestOptimizer(),
    NormalizeURLPlugin(),
  ]
}
