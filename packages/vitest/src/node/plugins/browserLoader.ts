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
import { setup as setupApiServer } from '../../api/setup'
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
): VitePlugin {
  return {
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
      const provider = browser.provider
      if (!provider || typeof provider.serverFactory !== 'function') {
        return
      }
      const contribution = await provider.serverFactory()
      holder.contribution = contribution
      const browserConfig = await contribution.config(viteConfig, harness)
      return browserConfig
    },
    applyToEnvironment(environment) {
      const contribution = holder.contribution
      if (contribution && environment.name === 'client') {
        return sortPluginsByEnforce(contribution.plugins)
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
  }
}

export async function createClusterServer(
  vitest: Vitest,
  viteConfig: ResolvedViteConfig,
  config: ResolvedConfig,
): Promise<{ server: ViteDevServer; parent?: ParentProjectBrowser }> {
  const contribution = config._browserContribution

  if (!contribution) {
    const server = await createViteServer(viteConfig)
    if (viteConfig.test.api?.port) {
      await server.listen()
    }
    return { server }
  }

  const parent = contribution.createParent({ config, vitest })
  contribution.parent = parent

  const server = await createViteServer(viteConfig)
  // TODO: respect server.api.port (?)
  await server.listen(vitest.state._data.browserLastPort++)
  contribution.setupRpc(parent)
  if (config.browser.ui) {
    setupApiServer(vitest, server)
  }
  return { server, parent }
}
