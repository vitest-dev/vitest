import type {
  ResolvedConfig as ResolvedViteConfig,
  UserConfig as ViteUserConfig,
} from 'vite'
import type { ResolvedConfig, UserConfig } from '../types/config'
import { slash } from '@vitest/utils'
import { findUp } from 'find-up'
import { resolve } from 'pathe'
import { mergeConfig, resolveConfig as resolveViteConfig } from 'vite'
import { configFiles } from '../../constants'
import { resolveConfig as resolveVitestConfig } from '../config/resolveConfig'
import { Vitest } from '../core'
import { VitestPlugin } from './index'

// this is only exported as a public function and not used inside vitest
export async function resolveConfig(
  options: UserConfig = {},
  viteOverrides: ViteUserConfig = {},
): Promise<{ vitestConfig: ResolvedConfig; viteConfig: ResolvedViteConfig }> {
  const root = slash(resolve(options.root || process.cwd()))

  const configPath
    = options.config === false
      ? false
      : options.config
        ? resolve(root, options.config)
        : await findUp(configFiles, { cwd: root } as any)
  options.config = configPath

  const vitest = new Vitest('test')
  const config = await resolveViteConfig(
    mergeConfig(
      {
        configFile: configPath,
        // this will make "mode": "test" | "benchmark" inside defineConfig
        mode: options.mode || 'test',
        plugins: [
          await VitestPlugin(options, vitest),
        ],
      },
      mergeConfig(viteOverrides, { root: options.root }),
    ),
    'serve',
  )
  // Reflect just to avoid type error
  const updatedOptions = Reflect.get(config, '_vitest') as UserConfig
  const vitestConfig = resolveVitestConfig(
    vitest,
    updatedOptions,
    config,
  )
  return {
    viteConfig: config,
    vitestConfig,
  }
}
