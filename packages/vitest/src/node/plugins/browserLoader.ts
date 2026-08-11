import type {
  ResolvedConfig as ResolvedViteConfig,
  ViteDevServer,
  Plugin as VitePlugin,
} from 'vite'
import type { PluginHarness } from '../config/pluginHarness'
import type { Vitest } from '../core'
import type {
  ParentProjectBrowser,
} from '../types/browser'
import type { ConfigResolutionCaptures, ResolvedConfig, ResolvedProjectEntry } from '../types/config'
import c from 'tinyrainbow'
import { createViteServer } from '../vite'
import { createViteLogger } from '../viteLogger'

function sortPluginsByEnforce(plugins: VitePlugin[]): VitePlugin[] {
  const pre: VitePlugin[] = []
  const normal: VitePlugin[] = []
  const post: VitePlugin[] = []
  for (const plugin of plugins) {
    if (plugin.enforce === 'pre') {
      pre.push(plugin)
    }
    else if (plugin.enforce === 'post') {
      post.push(plugin)
    }
    else {
      normal.push(plugin)
    }
  }
  return [...pre, ...normal, ...post]
}

export function BrowserLoaderPlugin(
  captures: ConfigResolutionCaptures,
  harness: PluginHarness,
): VitePlugin[] {
  return [
    {
      name: 'vitest:browser:loader',
      // `pre` so the browser plugins injected via `applyToEnvironment` land before
      // Vite's internal resolver in the `client` environment (so e.g. the
      // `vitest/browser` virtual module wins over the node stub resolution).
      enforce: 'pre',
      async config(viteConfig) {
        const browser = viteConfig.test?.browser
        if (!browser?.enabled) {
          return
        }
        // The provider can be configured at the project level or per instance
        // (e.g. connect mode). All instances in a project share one provider
        // (validated in `resolveTestConfig`), so any instance's server factory
        // builds the shared server.
        const provider = browser.provider
          ?? browser.instances?.find(instance => instance.provider)?.provider
        if (!provider || typeof provider.serverFactory !== 'function') {
          throw new Error(`Browser Mode was enabled, but provider was not specified anywhere. See https://vitest.dev/guide/browser/#configuration`)
        }
        const contribution = await provider.serverFactory()
        captures.browserContribution = contribution
        const browserConfig = await contribution.config(viteConfig, harness)
        const logLevel = viteConfig.logLevel ?? 'warn'
        const logger = createViteLogger(harness.logger, logLevel, {
          allowClearScreen: false,
        })
        return {
          ...browserConfig,
          customLogger: {
            ...logger,
            info(message, options) {
              const isOptimizerMessage
                = message.includes('dependency optimized')
                  || message.includes('dependencies optimized')
                  || message.includes('optimized dependencies changed. reloading')
              if (isOptimizerMessage) {
                logger.warn(message, options)
              }
              else {
                logger.info(message, options)
              }
              if (message.includes('optimized dependencies changed. reloading')) {
                logger.warn(
                  [
                    c.yellow(`\n${c.bold('[vitest]')} Vite unexpectedly reloaded a test. This may cause tests to fail, lead to flaky behaviour or duplicated test runs.\n`),
                    c.yellow(`For a stable experience, add the newly optimized dependencies to your config's ${c.bold('`optimizeDeps.include`')} field manually.\n`),
                  ].join(''),
                )
              }
            },
          },
        }
      },
      applyToEnvironment(environment) {
        const contribution = captures.browserContribution
        if (contribution && environment.name === 'client') {
          // `post` browser plugins are injected by `vitest:browser:loader:post`
          // instead, so they run after the `post` plugins of the main pipeline
          // rather than at this `pre` position. For example, the mocker's
          // `vitest:browser:esm-injector` must run after `vitest:mocks`, which is
          // added by the main pipeline and is not part of `contribution.plugins`.
          return sortPluginsByEnforce(
            contribution.plugins.filter(plugin => plugin.enforce !== 'post'),
          )
        }
        return false
      },
      configureServer: {
        order: 'pre',
        async handler(server) {
          await captures.browserContribution?.configureServer(server)
        },
      },
      transformIndexHtml: {
        order: 'pre',
        async handler(html, ctx) {
          return captures.browserContribution?.transformIndexHtml(ctx)
        },
      },
    },
    {
      name: 'vitest:browser:loader:post',
      enforce: 'post',
      applyToEnvironment(environment) {
        const contribution = captures.browserContribution
        if (contribution && environment.name === 'client') {
          return sortPluginsByEnforce(
            contribution.plugins.filter(plugin => plugin.enforce === 'post'),
          )
        }
        return false
      },
    },
  ]
}

export async function createClusterServer(
  vitest: Vitest,
  viteConfig: ResolvedViteConfig,
  config: ResolvedConfig,
  children: readonly ResolvedProjectEntry[],
): Promise<{ server: ViteDevServer; parent?: ParentProjectBrowser }> {
  const contribution = config._browserContribution

  if (!contribution) {
    const server = await createViteServer(viteConfig)
    if (config.api.port) {
      await server.listen(config.api.port)
    }
    return { server }
  }

  const parent = contribution.createParent({ config, vitest })
  contribution.parent = parent

  // Start browser launches now so their latency overlaps Vite server creation.
  // Entries that cannot run browser tests are skipped because they will never
  // initialize a provider that could adopt and close the prepared browser.
  for (const child of children) {
    if (
      child.hidden
      || child.hasTestFiles === false
      || (child.projectConfig.typecheck.enabled && child.projectConfig.typecheck.only)
    ) {
      continue
    }
    // The Vite server is shared, but each child carries its own resolved
    // provider and browser options, so it must be prewarmed independently.
    const projectConfig = child.projectConfig
    projectConfig.browser.provider?.prewarm?.({ config: projectConfig, vitest })
  }

  const server = await createViteServer(viteConfig)
  await server.listen(config.api.port)
  contribution.setupRpc(parent)
  return { server, parent }
}
