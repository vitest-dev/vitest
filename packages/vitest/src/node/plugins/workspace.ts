import { dirname, relative } from 'pathe'
import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
import { configDefaults } from '../../defaults'
import { generateScopedClassName } from '../../integrations/css/css-modules'
import { deepMerge } from '../../utils/base'
import type { WorkspaceProject } from '../workspace'
import type { UserWorkspaceConfig } from '../../types'
import { CoverageTransform } from './coverageTransform'
import { CSSEnablerPlugin } from './cssEnabler'
import { EnvReplacerPlugin } from './envReplacer'
import { GlobalSetupPlugin } from './globalSetup'

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
      // TODO: refactor so we don't have the same code here and in plugins/index.ts
      config(viteConfig) {
        if (viteConfig.define) {
          delete viteConfig.define['import.meta.vitest']
          delete viteConfig.define['process.env']
        }

        const env: Record<string, any> = {}

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
            env[envKey] = replacement
            delete viteConfig.define[key]
          }
          else if (key.startsWith('process.env.')) {
            const envKey = key.slice('process.env.'.length)
            env[envKey] = replacement
            delete viteConfig.define[key]
          }
        }

        const testConfig = viteConfig.test || {}

        const root = testConfig.root || viteConfig.root || options.root
        let name = testConfig.name
        if (!name) {
          if (typeof options.workspacePath === 'string')
            name = dirname(options.workspacePath).split('/').pop()
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
            // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
            // @ts-ignore we support Vite ^3.0, but browserField is available in Vite ^3.2
            browserField: false,
          },
          esbuild: {
            sourcemap: 'external',

            // Enables using ignore hint for coverage providers with @preserve keyword
            legalComments: 'inline',
          },
          server: {
            // disable watch mode in workspaces,
            // because it is handled by the top-level watcher
            watch: {
              ignored: ['**/*'],
              depth: 0,
              persistent: false,
            },
            open: false,
            hmr: false,
            preTransformRequests: false,
          },
          test: {
            env,
            name,
          },
        }

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
          await project.ctx.logger.printError(err, true)
          process.exit(1)
        }

        await server.watcher.close()
      },
    },
    EnvReplacerPlugin(),
    ...CSSEnablerPlugin(project),
    CoverageTransform(project.ctx),
    GlobalSetupPlugin(project, project.ctx.logger),
  ]
}
