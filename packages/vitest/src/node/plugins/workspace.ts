import type * as vite from 'vite'
import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
import type { PluginHarness } from '../config/pluginHarness'
import type { ResolvedConfig, TestProjectInlineConfiguration } from '../types/config'
import { API_TOKEN_FILE } from '../config/apiToken'
import { ROOT_DEFAULT_EXPERIMENTAL_OPTIONS, ROOT_DEFAULT_OPTIONS } from '../config/propagation'
import { VitestConfig } from './config'
import { CoverageTransform } from './coverageTransform'
import { CSSEnablerPlugin } from './cssEnabler'
import { MetaEnvReplacerPlugin } from './metaEnvReplacer'
import { MocksPlugins } from './mocks'
import { NormalizeURLPlugin } from './normalizeURL'
import { VitestConfigServer } from './server'
import { SsrRunnerFixerPlugin } from './ssrRunnerFixer'
import { VitestProjectResolver } from './vitestResolver'

interface WorkspaceOptions extends TestProjectInlineConfiguration {
  root?: string
}

export function WorkspaceVitestPlugin(
  harness: PluginHarness,
  globalViteConfig: vite.ResolvedConfig,
  globalConfig: ResolvedConfig,
  options: WorkspaceOptions,
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
        const root = options.root || testConfig.root || viteConfig.root

        const config: ViteConfig = {
          base: '/',
          root,
          server: {
            open: false,
            fs: {
              allow: globalViteConfig.server.fs.allow,
              deny: [API_TOKEN_FILE],
            },
          },
        }

        // always inherit these root values even without `extends: true`
        // TODO: remove this after "extends: false" is flipped
        for (const option of ROOT_DEFAULT_OPTIONS) {
          if (testConfig[option] == null && globalConfig[option] != null) {
            (testConfig as any)[option] = globalConfig[option]
          }
        }
        testConfig.experimental ??= {}
        for (const option of ROOT_DEFAULT_EXPERIMENTAL_OPTIONS) {
          if (testConfig.experimental[option] == null && globalConfig.experimental?.[option] != null) {
            (testConfig.experimental as any)[option] = globalConfig.experimental[option]
          }
        }

        return config
      },
      configResolved(config) {
        // project servers never watch; the top-level server owns the watcher
        config.server.watch = null
      },
    },
    ...VitestConfigServer(harness, globalConfig),
    SsrRunnerFixerPlugin(harness),
    MetaEnvReplacerPlugin(),
    ...CSSEnablerPlugin(),
    CoverageTransform(harness),
    ...VitestConfig(harness),
    ...MocksPlugins(),
    VitestProjectResolver(harness),
    NormalizeURLPlugin(),
  ]
}
