import type { ConfigEnv, UserConfig as ViteUserConfig } from 'vite'
import type { ProjectConfig } from './types'

export interface UserWorkspaceConfig extends ViteUserConfig {
  test?: ProjectConfig
}

// will import vitest declare test in module 'vite'
export { configDefaults, defaultInclude, defaultExclude, coverageConfigDefaults } from './defaults'
export { mergeConfig } from 'vite'

export type { ConfigEnv, ViteUserConfig as UserConfig }
export type UserConfigFnObject = (env: ConfigEnv) => ViteUserConfig
export type UserConfigFnPromise = (env: ConfigEnv) => Promise<ViteUserConfig>
export type UserConfigFn = (env: ConfigEnv) => ViteUserConfig | Promise<ViteUserConfig>
export type UserConfigExport = ViteUserConfig | Promise<ViteUserConfig> | UserConfigFnObject | UserConfigFnPromise | UserConfigFn

export type UserProjectConfigFn = (env: ConfigEnv) => UserWorkspaceConfig | Promise<UserWorkspaceConfig>
export type UserProjectConfigExport = UserWorkspaceConfig | Promise<UserWorkspaceConfig> | UserProjectConfigFn

export function defineConfig(config: ViteUserConfig): ViteUserConfig
export function defineConfig(config: Promise<ViteUserConfig>): Promise<ViteUserConfig>
export function defineConfig(config: UserConfigFnObject): UserConfigFnObject
export function defineConfig(config: UserConfigExport): UserConfigExport
export function defineConfig(config: UserConfigExport): UserConfigExport {
  return config
}

export function defineProject<T extends UserProjectConfigExport>(config: T): T {
  return config
}

type Workspace = (string | (UserProjectConfigExport & { extends?: string }))

export function defineWorkspace(config: Workspace[]): Workspace[] {
  return config
}
