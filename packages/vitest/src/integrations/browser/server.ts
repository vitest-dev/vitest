import { createServer } from 'vite'
import { defaultBrowserPort } from '../../constants'
import { ensurePackageInstalled } from '../../node/pkg'
import { resolveApiServerConfig } from '../../node/config'
import { CoverageTransform } from '../../node/plugins/coverageTransform'
import type { WorkspaceProject } from '../../node/workspace'
import { MocksPlugin } from '../../node/plugins/mocks'
import { resolveFsAllow } from '../../node/plugins/utils'

export async function createBrowserServer(project: WorkspaceProject, configFile: string | undefined) {
  const root = project.config.root

  await ensurePackageInstalled('@vitest/browser', root)

  const configPath = typeof configFile === 'string' ? configFile : false

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

          // browser never runs in middleware mode
          server.middlewareMode = false

          config.server = {
            ...config.server,
            ...server,
          }
          config.server.fs ??= {}
          config.server.fs.allow = config.server.fs.allow || []
          config.server.fs.allow.push(
            ...resolveFsAllow(
              project.ctx.config.root,
              project.ctx.server.config.configFile,
            ),
          )

          return {
            resolve: {
              alias: config.test?.alias,
            },
            server: {
              watch: null,
            },
          }
        },
      },
      MocksPlugin(),
    ],
  })

  await server.listen()

  ;(await import('../../api/setup')).setup(project, server)

  return server
}
