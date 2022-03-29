import type { UserConfig as ViteUserConfig } from 'vite'

export interface UserConfig extends ViteUserConfig {
  test?: ViteUserConfig['test']
}

// will import vitest declare test in module 'vite'
export { configDefaults } from './defaults'

export function defineConfig(config: UserConfig) {
  return config
}
