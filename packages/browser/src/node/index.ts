import type { BrowserCommand, BrowserProviderOption, BrowserServerFactory } from 'vitest/node'
import { MockerRegistry } from '@vitest/mocker'
import { interceptorPlugin } from '@vitest/mocker/node'
import c from 'tinyrainbow'
import { createViteLogger, createViteServer } from 'vitest/node'
import { version } from '../../package.json'
import { distRoot } from './constants'
import BrowserPlugin from './plugin'
import { ParentBrowserProject } from './projectParent'
import { setupBrowserRpc } from './rpc'

export type { CustomComparatorsRegistry } from './commands/screenshotMatcher/types'

export function defineBrowserCommand<T extends unknown[]>(
  fn: BrowserCommand<T>,
): BrowserCommand<T> {
  return fn
}

// export type { ProjectBrowser } from './project'
export { parseKeyDef, resolveScreenshotPath } from './utils'

export const createBrowserServer: BrowserServerFactory = async (options) => {
  const project = options.project
  const configFile = project.vite.config.configFile

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

  const mockerRegistry = new MockerRegistry()

  let cacheDir: string
  const vite = await createViteServer({
    ...project.options, // spread project config inlined in root workspace config
    define: project.config.viteDefine,
    base: '/',
    root: project.config.root,
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
    configLoader: project.vite.config.inlineConfig.configLoader,
    // watch is handled by Vitest
    server: {
      hmr: false,
      watch: null,
    },
    cacheDir: project.vite.config.cacheDir,
    plugins: [
      {
        name: 'vitest-internal:browser-cacheDir',
        configResolved(config) {
          cacheDir = config.cacheDir
        },
      },
      ...options.mocksPlugins({
        filter(id) {
          if (id.includes(distRoot) || id.includes(cacheDir)) {
            return false
          }
          return true
        },
      }),
      options.metaEnvReplacer(),
      ...(project.options?.plugins || []),
      BrowserPlugin(server),
      interceptorPlugin({ registry: mockerRegistry }),
      options.coveragePlugin(),
    ],
  })

  await vite.listen()

  setupBrowserRpc(server, mockerRegistry)

  return server
}

export function defineBrowserProvider<T extends object = object>(options: Omit<
  BrowserProviderOption<T>,
  'serverFactory' | 'options'
> & { options?: T }): BrowserProviderOption {
  return {
    ...options,
    options: options.options || {},
    serverFactory: createBrowserServer,
  }
}
