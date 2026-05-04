import type { BrowserCommand, BrowserProviderOption, BrowserServerFactory } from 'vitest/node'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { MockerRegistry } from '@vitest/mocker'
import { interceptorPlugin } from '@vitest/mocker/node'
import { dirname, join } from 'pathe'
import c from 'tinyrainbow'
import { createViteLogger, createViteServer } from 'vitest/node'
import { version } from '../../package.json'
import { distRoot } from './constants'
import BrowserPlugin from './plugin'
import { ParentBrowserProject } from './projectParent'
import { setupBrowserRpc } from './rpc'

export type { CustomComparatorsRegistry } from './commands/screenshotMatcher/types'

export interface SerializedLocator {
  selector: string
  locator: string
}

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

  assertSingleInstallation(project.config.root, project.name)

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
      ...project.options?.server,
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

function resolvePackageDir(name: string, fromDir: string): string | undefined {
  try {
    const require = createRequire(join(fromDir, '_'))
    return dirname(require.resolve(`${name}/package.json`))
  }
  catch {
    return undefined
  }
}

function assertSingleInstallation(projectRoot: string, projectName: string): void {
  const runningFrom = dirname(fileURLToPath(import.meta.url))
  const runningBrowserDir = resolvePackageDir('@vitest/browser', runningFrom)
  const runningVitestDir = resolvePackageDir('vitest', runningFrom)
  const projectBrowserDir = resolvePackageDir('@vitest/browser', projectRoot)
  const projectVitestDir = resolvePackageDir('vitest', projectRoot)

  const mismatches: { name: string, running: string, project: string }[] = []
  if (runningBrowserDir && projectBrowserDir && projectBrowserDir !== runningBrowserDir) {
    mismatches.push({ name: '@vitest/browser', running: runningBrowserDir, project: projectBrowserDir })
  }
  if (runningVitestDir && projectVitestDir && projectVitestDir !== runningVitestDir) {
    mismatches.push({ name: 'vitest', running: runningVitestDir, project: projectVitestDir })
  }
  if (!mismatches.length) {
    return
  }

  const lines = mismatches.map(m =>
    `  - ${c.bold(m.name)}\n    running:  ${m.running}\n    project:  ${m.project}`,
  ).join('\n')

  throw new Error(
    `[vitest] Detected duplicate installations of Vitest packages for project "${projectName || projectRoot}".\n`
    + `This is unsupported in browser mode with \`projects\` and will cause tests to hang.\n\n`
    + `${lines}\n\n`
    + `To fix this:\n`
    + `  1. Run \`pnpm why vitest\` (or \`npm ls vitest\`) to find why a package is duplicated.\n`
    + `     A common cause is a peer dependency (e.g. \`@types/node\`, \`vite\`) resolving\n`
    + `     to different versions across packages.\n`
    + `  2. Recommended: declare \`vitest\` and \`@vitest/browser*\` only in the root\n`
    + `     package.json, not in each sub-package, so they are hoisted as a single copy.\n`
    + `  3. Otherwise, force a single version with \`pnpm.overrides\` / \`resolutions\`\n`
    + `     for the diverging peer dependency, then run \`pnpm dedupe\`.\n\n`
    + `See https://vitest.dev/guide/common-errors.html#duplicate-vitest-installation`,
  )
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
