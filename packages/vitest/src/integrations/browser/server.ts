import { createServer } from 'vite'
import { resolve } from 'pathe'
import { findUp } from 'find-up'
import { configFiles, defaultBrowserPort } from '../../constants'
import type { UserConfig } from '../../types/config'
import { ensurePackageInstalled } from '../../node/pkg'
import { resolveApiServerConfig } from '../../node/config'
import { CoverageTransform } from '../../node/plugins/coverageTransform'
import type { WorkspaceProject } from '../../node/workspace'
import { MocksPlugin } from '../../node/plugins/mocks'

export async function createBrowserServer(project: WorkspaceProject, options: UserConfig) {
  const root = project.config.root

  await ensurePackageInstalled('@vitest/browser', root)

  const configPath = options.config === false
    ? false
    : options.config
      ? resolve(root, options.config)
      : await findUp(configFiles, { cwd: root } as any)

  const server = await createServer({
    logLevel: 'error',
    mode: project.config.mode,
    configFile: configPath,
    // watch is handled by Vitest
    server: {
      hmr: false,
      watch: {
        ignored: ['**/**'],
      },
    },
    plugins: [
      (await import('@vitest/browser')).default(project, '/'),
      CoverageTransform(project.ctx),
      {
        enforce: 'post',
        name: 'vitest:browser:config',
        async config(config) {
          const server = resolveApiServerConfig(config.test?.browser || {}) || {
            port: defaultBrowserPort,
          }

          config.server = server
          config.server.fs ??= {}
          config.server.fs.strict = false

          return {
            resolve: {
              alias: config.test?.alias,
            },
          }
        },
      },
      MocksPlugin(),
    ],
  })

  await server.listen()
  await server.watcher.close()

  ;(await import('../../api/setup')).setup(project, server)

  return server
}
