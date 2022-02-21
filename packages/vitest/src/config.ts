import type { UserConfig } from 'vite'
import type { InlineConfig } from './types'

interface UserConfig$1 extends UserConfig {
  test?: InlineConfig
}

export { configDefaults } from './defaults'
export function defineConfig(config: UserConfig$1) {
  return config
}
