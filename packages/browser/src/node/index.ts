import type { WorkspaceProject } from 'vitest/node'
import type { Plugin } from 'vitest/config'
import { createServer } from 'vitest/node'
import { setupBrowserRpc } from './rpc'
import { BrowserServer } from './server'
import BrowserPlugin from './plugin'

export type { BrowserServer } from './server'
export { createBrowserPool } from './pool'

export async function createBrowserServer(
  project: WorkspaceProject,
  configFile: string | undefined,
  prePlugins: Plugin[] = [],
  postPlugins: Plugin[] = [],
) {
  const server = new BrowserServer(project, '/')

  const root = project.config.root

  await project.ctx.packageInstaller.ensureInstalled('@vitest/browser', root)

  const configPath = typeof configFile === 'string' ? configFile : false

  const vite = await createServer({
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
      ...prePlugins,
      ...(project.options?.plugins || []),
      BrowserPlugin(server),
      ...postPlugins,
    ],
  })

  await vite.listen()

  setupBrowserRpc(server)
  // if (project.config.browser.ui) {
  //   setupUiRpc(project.ctx, server)
  // }

  return server
}
