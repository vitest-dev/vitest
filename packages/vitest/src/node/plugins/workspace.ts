import type * as vite from 'vite'
import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
import type { PluginHarness } from '../config/pluginHarness'
import type { ResolvedConfig, TestProjectInlineConfiguration } from '../types/config'
import { API_TOKEN_FILE } from '../config/apiToken'
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

        // always inherit the global `fsModuleCache` values even without `extends: true`
        if (testConfig.fsModuleCache == null && globalConfig.fsModuleCache != null) {
          testConfig.fsModuleCache = globalConfig.fsModuleCache
        }
        if (testConfig.fsModuleCachePath == null && globalConfig.fsModuleCachePath != null) {
          testConfig.fsModuleCachePath = globalConfig.fsModuleCachePath
        }

        // TODO: remove this after "extends: false" is flipped
        testConfig.experimental ??= {}

        if (testConfig.experimental?.viteModuleRunner == null && globalConfig.experimental?.viteModuleRunner != null) {
          testConfig.experimental.viteModuleRunner = globalConfig.experimental.viteModuleRunner
        }
        if (testConfig.experimental?.nodeLoader == null && globalConfig.experimental?.nodeLoader != null) {
          testConfig.experimental.nodeLoader = globalConfig.experimental.nodeLoader
        }
        if (testConfig.experimental?.importDurations == null && globalConfig.experimental?.importDurations != null) {
          testConfig.experimental.importDurations = globalConfig.experimental.importDurations
        }

        return config
      },
      configResolved(config) {
        // Projects always inherit non-project config options
        config.test.coverage = globalConfig.coverage
        config.test.attachmentsDir = globalConfig.attachmentsDir
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
