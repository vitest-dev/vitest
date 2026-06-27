import type { Plugin as VitePlugin } from 'vite'
import type { CliOptions } from '../cli/cli-api'
import type { PluginHarness } from '../config/pluginHarness'
import { resolve } from 'pathe'
import { VitestConfigApi } from './api'
import { VitestConfig } from './config'
import { CoverageTransform } from './coverageTransform'
import { CSSEnablerPlugin } from './cssEnabler'
import { MetaEnvReplacerPlugin } from './metaEnvReplacer'
import { MocksPlugins } from './mocks'
import { NormalizeURLPlugin } from './normalizeURL'
import { SsrRunnerFixerPlugin } from './ssrRunnerFixer'
import { VitestCoreResolver } from './vitestResolver'

// the plugins required when starting Vitest
export function VitestCorePlugin(harness: PluginHarness): VitePlugin[] {
  return [
    ...CSSEnablerPlugin(),
    ...MocksPlugins(),
    CoverageTransform(harness),
    VitestCoreResolver(),
    NormalizeURLPlugin(),
    MetaEnvReplacerPlugin(),
    SsrRunnerFixerPlugin(harness),
    {
      name: 'vitest:ui-injector',
      enforce: 'post',
      async configResolved(config) {
        if (config.test.ui) {
          await harness.packageInstaller.ensureInstalled('@vitest/ui', resolve(config.root), harness.version)
          const uiPlugin = (await import('@vitest/ui')).default(harness)
          // @ts-expect-error mutate readonly
          config.plugins.push(uiPlugin)
        }
      },
    },
  ]
}

// the plugins required when resolving the config
export function VitestConfigPlugin(harness: PluginHarness, options: CliOptions = {}): VitePlugin[] {
  return [
    // Setting Vite config values based on user settings,
    // The resolved config value is determined in `configResolved:post`
    // This is simmilar to `vitest:config` plugin, but the options here are affected by CLI
    {
      name: 'vitest:config:append',
      enforce: 'post',
      options() {
        this.meta.watchMode = false
      },
      config: {
        order: 'post',
        handler(viteConfig) {
          const root = resolve(options.root || viteConfig.test?.root || viteConfig.root || process.cwd())

          return {
            base: '/',
            root,
            build: {
              // Vitest doesn't use outputDir, but this value affects what folders are watched
              // https://github.com/vitejs/vite/pull/16453
              emptyOutDir: false,
            },
          }
        },
      },
    },
    VitestConfigApi(harness),
    ...VitestConfig(harness),
  ]
}
