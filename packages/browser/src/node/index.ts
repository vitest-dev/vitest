import type { Plugin } from 'vitest/config'
import type { TestProject } from 'vitest/node'
import c from 'tinyrainbow'
import { createViteLogger, createViteServer } from 'vitest/node'
import { version } from '../../package.json'
import BrowserPlugin from './plugin'
import { ParentBrowserProject } from './projectParent'
import { setupBrowserRpc } from './rpc'

export { distRoot } from './constants'
export { createBrowserPool } from './pool'

export type { ProjectBrowser } from './project'

export async function createBrowserServer(
  project: TestProject,
  configFile: string | undefined,
  prePlugins: Plugin[] = [],
  postPlugins: Plugin[] = [],
) {
  if (project.vitest.version !== version) {
    project.vitest.logger.warn(
      c.yellow(
        `Loaded ${c.inverse(c.yellow(` vitest@${project.vitest.version} `))} and ${c.inverse(c.yellow(` @vitest/browser@${version} `))}.`
        + '\nRunning mixed versions is not supported and may lead into bugs'
        + '\nUpdate your dependencies and make sure the versions match.',
      ),
    )
  }

  const server = new ParentBrowserProject(project, '/')

  const configPath = typeof configFile === 'string' ? configFile : false

  const logLevel = (process.env.VITEST_BROWSER_DEBUG as 'info') ?? 'info'

  const logger = createViteLogger(project.vitest.logger, logLevel, {
    allowClearScreen: false,
  })

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
