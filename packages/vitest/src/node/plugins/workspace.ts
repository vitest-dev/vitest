import type * as vite from 'vite'
import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
import type { PluginHarness } from '../config/pluginHarness'
import { resolve } from 'pathe'
import { API_TOKEN_FILE } from '../config/apiToken'
import { ViteConfigPlugin } from './config'
import { CoverageTransform } from './coverageTransform'
import { CSSEnablerPlugin } from './cssEnabler'
import { MetaEnvReplacerPlugin } from './metaEnvReplacer'
import { MocksPlugins } from './mocks'
import { NormalizeURLPlugin } from './normalizeURL'
import { SsrRunnerFixerPlugin } from './ssrRunnerFixer'
import { resolveTestCacheDir } from './utils'
import { VitestProjectResolver } from './vitestResolver'

export function WorkspaceVitestPlugin(
  harness: PluginHarness,
  globalViteConfig: vite.ResolvedConfig,
): VitePlugin[] {
  return [
    {
      name: 'vitest:project',
      enforce: 'post',
      options() {
        this.meta.watchMode = false
      },
      config(viteConfig) {
        const testConfig = viteConfig.test || {}
        const root = testConfig.root || viteConfig.root

        const config: ViteConfig = {
          base: '/',
          root,
          cacheDir: resolveTestCacheDir(
            resolve(root || process.cwd()),
            testConfig,
            viteConfig.cacheDir,
          ),
          server: {
            open: false,
            fs: {
              allow: globalViteConfig.server.fs.allow,
              deny: [API_TOKEN_FILE],
            },
          },
        }

        return config
      },
      configResolved(config) {
        // project servers never watch; the top-level server owns the watcher
        config.server.watch = null
      },
    },
    SsrRunnerFixerPlugin(harness),
    MetaEnvReplacerPlugin(),
    ...CSSEnablerPlugin(),
    CoverageTransform(harness),
    ...ViteConfigPlugin(harness),
    ...MocksPlugins(),
    VitestProjectResolver(harness),
    NormalizeURLPlugin(),
  ]
}
