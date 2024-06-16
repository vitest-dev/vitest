import { createServer } from 'vite'
import { defaultBrowserPort } from '../../constants'
import { resolveApiServerConfig } from '../../node/config'
import { CoverageTransform } from '../../node/plugins/coverageTransform'
import type { WorkspaceProject } from '../../node/workspace'
import { MocksPlugin } from '../../node/plugins/mocks'
import { resolveFsAllow } from '../../node/plugins/utils'
import { setupBrowserRpc } from '../../api/browser'
import { setup as setupUiRpc } from '../../api/setup'

export async function createBrowserServer(
  project: WorkspaceProject,
  configFile: string | undefined,
) {
  const root = project.config.root

  await project.ctx.packageInstaller.ensureInstalled('@vitest/browser', root)

  const configPath = typeof configFile === 'string' ? configFile : false

  const server = await createServer({
    ...project.options, // spread project config inlined in root workspace config
    base: '/',
    logLevel: 'error',
    mode: project.config.mode,
    configFile: configPath,
    // watch is handled by Vitest
    server: {
      hmr: false,
      watch: null,
      preTransformRequests: false,
    },
    plugins: [
      ...(project.options?.plugins || []),
      MocksPlugin(),
      (await import('@vitest/browser')).default(project, '/'),
      CoverageTransform(project.ctx),
      {
        enforce: 'post',
        name: 'vitest:browser:config',
        async config(config) {
          const server = resolveApiServerConfig(
            config.test?.browser || {},
            defaultBrowserPort,
          ) || {
            port: defaultBrowserPort,
          }

          // browser never runs in middleware mode
          server.middlewareMode = false

          config.server = {
            ...config.server,
            ...server,
            open: false,
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
          }
        },
      },
    ],
  })

  await server.listen()

  setupBrowserRpc(project, server)
  if (project.config.browser.ui) {
    setupUiRpc(project.ctx, server)
  }

  return server
}
