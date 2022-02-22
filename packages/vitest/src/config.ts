import type { UserConfig as ViteUserConfig } from 'vite'
import type { InlineConfig } from './types'

export interface UserConfig extends ViteUserConfig {
  test?: InlineConfig
}

export { configDefaults } from './defaults'

export function defineConfig(config: UserConfig) {
  return config
}
