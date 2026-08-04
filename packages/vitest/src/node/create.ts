import type {
  UserConfig as ViteUserConfig,
} from 'vite'
import type { CliOptions } from './cli/cli-api'
import type { VitestOptions } from './core'
import type { VitestRunMode } from './types/config'
import { PluginHarness } from './config/pluginHarness'
import { resolveConfig } from './config/resolveConfig'
import { Vitest } from './core'
import { Logger } from './logger'
import { VitestPackageInstaller } from './packageInstaller'

export async function createVitest(
  options: CliOptions,
  viteOverrides?: ViteUserConfig,
  vitestOptions?: VitestOptions,
): Promise<Vitest>
/**
 * @deprecated The `mode` argument is no longer used. Use `createVitest(options, viteOverrides?, vitestOptions?)` instead.
 */
export async function createVitest(
  mode: VitestRunMode,
  options: CliOptions,
  viteOverrides?: ViteUserConfig,
  vitestOptions?: VitestOptions,
): Promise<Vitest>
export async function createVitest(
  modeOrOptions: VitestRunMode | CliOptions,
  optionsOrViteOverrides: CliOptions | ViteUserConfig = {},
  viteOverridesOrVitestOptions: ViteUserConfig | VitestOptions = {},
  maybeVitestOptions: VitestOptions = {},
): Promise<Vitest> {
  let options: CliOptions
  let viteOverrides: ViteUserConfig
  let vitestOptions: VitestOptions
  if (typeof modeOrOptions === 'string') {
    options = optionsOrViteOverrides as CliOptions
    viteOverrides = viteOverridesOrVitestOptions as ViteUserConfig
    vitestOptions = maybeVitestOptions
  }
  else {
    options = modeOrOptions
    viteOverrides = optionsOrViteOverrides as ViteUserConfig
    vitestOptions = viteOverridesOrVitestOptions as VitestOptions
  }

  const logger = new Logger(vitestOptions.stdout, vitestOptions.stderr)
  const packageInstaller = vitestOptions.packageInstaller ?? new VitestPackageInstaller()
  const pluginHarness = new PluginHarness(logger, packageInstaller)

  const config = await resolveConfig(
    options,
    viteOverrides,
    pluginHarness,
  )

  const vitest = new Vitest(
    pluginHarness,
    config,
  )

  try {
    await vitest._start(config)

    if (vitest.config.api.port && vitest.config.ui && vitest.config.open) {
      vitest.vite.openBrowser()
    }

    return vitest
  }
  // Vitest can fail at any point during setup or inside a custom plugin.
  // Make sure everything is properly closed (like the logger).
  catch (error) {
    await vitest.close()
    throw error
  }
}
