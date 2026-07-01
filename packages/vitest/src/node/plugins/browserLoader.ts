import type {
  ResolvedConfig as ResolvedViteConfig,
  ViteDevServer,
  Plugin as VitePlugin,
} from 'vite'
import type { PluginHarness } from '../config/pluginHarness'
import type { Vitest } from '../core'
import type {
  BrowserServerContribution,
  ParentProjectBrowser,
} from '../types/browser'
import type { ResolvedConfig } from '../types/config'
import { createViteServer } from '../vite'

export interface BrowserContributionHolder {
  contribution?: BrowserServerContribution
}

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
  holder: BrowserContributionHolder,
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
        holder.contribution = contribution
        const browserConfig = await contribution.config(viteConfig, harness)
        return browserConfig
      },
      applyToEnvironment(environment) {
        const contribution = holder.contribution
        if (contribution && environment.name === 'client') {
          // `post` browser plugins are injected by `vitest:browser:loader:post`
          // instead, so they run after the `post` plugins of the main pipeline
          // (e.g. `vitest:mocks` hoisting) rather than at this `pre` position.
          return sortPluginsByEnforce(
            contribution.plugins.filter(plugin => plugin.enforce !== 'post'),
          )
        }
        return false
      },
      configureServer: {
        order: 'pre',
        async handler(server) {
          await holder.contribution?.configureServer(server)
        },
      },
      transformIndexHtml: {
        order: 'pre',
        async handler(html, ctx) {
          return holder.contribution?.transformIndexHtml(ctx)
        },
      },
    },
    {
      name: 'vitest:browser:loader:post',
      enforce: 'post',
      applyToEnvironment(environment) {
        const contribution = holder.contribution
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

  const server = await createViteServer(viteConfig)
  await server.listen(config.api.port)
  contribution.setupRpc(parent)
  return { server, parent }
}
