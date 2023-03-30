import type { ConfigEnv, UserConfig as ViteUserConfig } from 'vite'
import type { WorkspaceConfig } from './types'

export interface UserConfig extends ViteUserConfig {
  test?: ViteUserConfig['test']
}

export interface UserWorkspaceConfig extends ViteUserConfig {
  test?: WorkspaceConfig
}

// will import vitest declare test in module 'vite'
export { configDefaults, defaultInclude, defaultExclude, coverageConfigDefaults } from './defaults'
export { mergeConfig } from 'vite'

export type { ConfigEnv }
export type UserConfigFn = (env: ConfigEnv) => UserConfig | Promise<UserConfig>
export type UserConfigExport = UserConfig | Promise<UserConfig> | UserConfigFn

export type UserWorkspaceConfigFn = (env: ConfigEnv) => UserWorkspaceConfig | Promise<UserWorkspaceConfig>
export type UserWorkspaceConfigExport = UserWorkspaceConfig | Promise<UserWorkspaceConfig> | UserWorkspaceConfigFn

export function defineConfig(config: UserConfigExport) {
  return config
}

export function defineWorkspace(config: UserWorkspaceConfigExport) {
  return config
}
