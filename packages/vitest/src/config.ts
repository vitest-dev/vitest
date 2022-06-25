import type { ConfigEnv, UserConfig as ViteUserConfig } from 'vite'

export interface UserConfig extends ViteUserConfig {
  test?: ViteUserConfig['test']
}

// will import vitest declare test in module 'vite'
export { configDefaults } from './defaults'

export type { ConfigEnv }
export type UserConfigFn = (env: ConfigEnv) => UserConfig | Promise<UserConfig>
export type UserConfigExport = UserConfig | Promise<UserConfig> | UserConfigFn

export function defineConfig(config: UserConfigExport) {
  return config
}
