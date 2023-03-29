import { relative } from 'pathe'
import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
import { generateScopedClassName } from '../../integrations/css/css-modules'
import type { VitestWorkspace } from '../workspace'
import { CoverageTransform } from './coverageTransform'
import { CSSEnablerPlugin } from './cssEnabler'
import { EnvReplacerPlugin } from './envReplacer'

export function WorkspaceVitestPlugin(workspace: VitestWorkspace) {
  return <VitePlugin[]>[
    {
      name: 'vitest:workspace',
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

        const options = workspace.ctx.config

        const config: ViteConfig = {
          resolve: {
            // by default Vite resolves `module` field, which not always a native ESM module
            // setting this option can bypass that and fallback to cjs version
            mainFields: [],
            alias: workspace.ctx.config.alias,
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
          },
          test: {
            env,
          },
        }

        const classNameStrategy = (typeof options.css !== 'boolean' && options.css?.modules?.classNameStrategy) || 'stable'

        if (classNameStrategy !== 'scoped') {
          config.css ??= {}
          config.css.modules ??= {}
          config.css.modules.generateScopedName = (name: string, filename: string) => {
            return generateScopedClassName(classNameStrategy, name, relative(options.root, filename))!
          }
        }

        return config
      },
      async configureServer(server) {
        try {
          await workspace.setServer(server.config.test || {}, server)
        }
        catch (err) {
          await workspace.ctx.logger.printError(err, true)
          process.exit(1)
        }

        await server.watcher.close()
      },
    },
    EnvReplacerPlugin(),
    ...CSSEnablerPlugin(workspace),
    CoverageTransform(workspace.ctx),
  ]
}
