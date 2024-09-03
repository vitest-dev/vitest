import type { WorkspaceProject } from 'vitest/node'
import type { Plugin } from 'vitest/config'
import { createViteLogger, createViteServer } from 'vitest/node'
import c from 'tinyrainbow'
import { version } from '../../package.json'
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
  if (project.ctx.version !== version) {
    project.ctx.logger.warn(
      c.yellow(
        `Loaded ${c.inverse(c.yellow(` vitest@${project.ctx.version} `))} and ${c.inverse(c.yellow(` @vitest/browser@${version} `))}.`
        + '\nRunning mixed versions is not supported and may lead into bugs'
        + '\nUpdate your dependencies and make sure the versions match.',
      ),
    )
  }

  const server = new BrowserServer(project, '/')

  const configPath = typeof configFile === 'string' ? configFile : false

  const logLevel = (process.env.VITEST_BROWSER_DEBUG as 'info') ?? 'info'

  const logger = createViteLogger(logLevel)

  const vite = await createViteServer({
    ...project.options, // spread project config inlined in root workspace config
    base: '/',
    logLevel,
    customLogger: {
      ...logger,
      info(msg, options) {
        logger.info(msg, options)
        if (msg.includes('optimized dependencies changed. reloading')) {
          logger.warn(
            [
              c.yellow(`\n${c.bold('[vitest]')} Vite unexpectedly reloaded a test. This may cause tests to fail, lead to flaky behaviour or duplicated test runs.\n`),
              c.yellow(`For a stable experience, please add mentioned dependencies to your config\'s ${c.bold('\`optimizeDeps.include\`')} field manually.\n\n`),
            ].join(''),
          )
        }
      },
    },
    mode: project.config.mode,
    configFile: configPath,
    // watch is handled by Vitest
    server: {
      hmr: false,
      watch: null,
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

  return server
}
