import { basename, dirname, relative } from 'pathe'
import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
import { configDefaults } from '../../defaults'
import { generateScopedClassName } from '../../integrations/css/css-modules'
import { deepMerge } from '../../utils/base'
import type { WorkspaceProject } from '../workspace'
import type { ResolvedConfig, UserWorkspaceConfig } from '../../types'
import { CoverageTransform } from './coverageTransform'
import { CSSEnablerPlugin } from './cssEnabler'
import { SsrReplacerPlugin } from './ssrReplacer'
import { MocksPlugin } from './mocks'
import { deleteDefineConfig, hijackVitePluginInject, resolveFsAllow } from './utils'
import { VitestResolver } from './vitestResolver'
import { VitestOptimizer } from './optimizer'
import { NormalizeURLPlugin } from './normalizeURL'

interface WorkspaceOptions extends UserWorkspaceConfig {
  root?: string
  workspacePath: string | number
}

export function WorkspaceVitestPlugin(project: WorkspaceProject, options: WorkspaceOptions) {
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
          if (typeof options.workspacePath === 'string')
            name = basename(options.workspacePath.endsWith('/') ? options.workspacePath.slice(0, -1) : dirname(options.workspacePath))
          else
            name = options.workspacePath.toString()
        }

        const config: ViteConfig = {
          root,
          resolve: {
            // by default Vite resolves `module` field, which not always a native ESM module
            // setting this option can bypass that and fallback to cjs version
            mainFields: [],
            alias: testConfig.alias,
            conditions: ['node'],
          },
          esbuild: {
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
            preTransformRequests: false,
            middlewareMode: true,
            fs: {
              allow: resolveFsAllow(
                project.ctx.config.root,
                project.ctx.server.config.configFile,
              ),
            },
          },
          test: {
            name,
          },
        }

        ;(config.test as ResolvedConfig).defines = defines

        const classNameStrategy = (typeof testConfig.css !== 'boolean' && testConfig.css?.modules?.classNameStrategy) || 'stable'

        if (classNameStrategy !== 'scoped') {
          config.css ??= {}
          config.css.modules ??= {}
          if (config.css.modules) {
            config.css.modules.generateScopedName = (name: string, filename: string) => {
              const root = project.config.root
              return generateScopedClassName(classNameStrategy, name, relative(root, filename))!
            }
          }
        }

        return config
      },
      configResolved(viteConfig) {
        hijackVitePluginInject(viteConfig)
      },
      async configureServer(server) {
        try {
          const options = deepMerge(
            {},
            configDefaults,
            server.config.test || {},
          )
          await project.setServer(options, server)
        }
        catch (err) {
          await project.ctx.logger.printError(err, { fullStack: true })
          process.exit(1)
        }

        await server.watcher.close()
      },
    },
    SsrReplacerPlugin(),
    ...CSSEnablerPlugin(project),
    CoverageTransform(project.ctx),
    MocksPlugin(),
    VitestResolver(project.ctx),
    VitestOptimizer(),
    NormalizeURLPlugin(),
  ]
}
