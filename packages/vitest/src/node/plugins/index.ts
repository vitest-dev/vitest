import type { Plugin as VitePlugin } from 'vite'
import type { CliOptions } from '../cli/cli-api'
import type { PluginHarness } from '../config/pluginHarness'
import { resolve } from 'pathe'
import { configDefaults } from '../../defaults'
import { CoverageTransform } from './coverageTransform'
import { CSSEnablerPlugin } from './cssEnabler'
import { MetaEnvReplacerPlugin } from './metaEnvReplacer'
import { MocksPlugins } from './mocks'
import { NormalizeURLPlugin } from './normalizeURL'
import { SsrRunnerFixerPlugin } from './ssrRunnerFixer'
import { VitestCoreResolver } from './vitestResolver'

export function VitestCorePlugin(harness: PluginHarness, options: CliOptions = {}): VitePlugin[] {
  return [
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
      configResolved: {
        order: 'post',
        handler(viteConfig) {
          // During resolution so Vite uses the real fs when watch is off (a cached
          // snapshot misses runtime-generated files); the default is applied later
          // by `resolveTestConfig`, hence the `??`.
          const server = viteConfig.server
          const watch = viteConfig.test?.watch ?? configDefaults.watch
          if (!watch) {
            server.watch = null
          }
          else {
            server.watch ??= {}
            // chokidar fsevents is unstable on macos when emitting the "ready" event
            if (process.platform === 'darwin' && process.env.VITE_TEST_WATCHER_DEBUG) {
              server.watch.useFsEvents = false
              server.watch.usePolling = false
            }
          }
        },
      },
    },
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
