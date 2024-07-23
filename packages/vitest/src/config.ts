import type { ConfigEnv, UserConfig as ViteUserConfig } from 'vite'
import type { ProjectConfig } from './types'

export interface UserWorkspaceConfig extends ViteUserConfig {
  test?: ProjectConfig
}

// will import vitest declare test in module 'vite'
export {
  defaultBrowserPort,
  configDefaults,
  defaultInclude,
  defaultExclude,
  coverageConfigDefaults,
} from './defaults'
export { mergeConfig } from 'vite'
export { extraInlineDeps } from './constants'
export type { Plugin } from 'vite'

export type { ConfigEnv, ViteUserConfig as UserConfig }
export type UserConfigFnObject = (env: ConfigEnv) => ViteUserConfig
export type UserConfigFnPromise = (env: ConfigEnv) => Promise<ViteUserConfig>
export type UserConfigFn = (
  env: ConfigEnv
) => ViteUserConfig | Promise<ViteUserConfig>
export type UserConfigExport =
  | ViteUserConfig
  | Promise<ViteUserConfig>
  | UserConfigFnObject
  | UserConfigFnPromise
  | UserConfigFn

export type UserProjectConfigFn = (
  env: ConfigEnv
) => UserWorkspaceConfig | Promise<UserWorkspaceConfig>
export type UserProjectConfigExport =
  | UserWorkspaceConfig
  | Promise<UserWorkspaceConfig>
  | UserProjectConfigFn

export function defineConfig(config: ViteUserConfig): ViteUserConfig
export function defineConfig(
  config: Promise<ViteUserConfig>
): Promise<ViteUserConfig>
export function defineConfig(config: UserConfigFnObject): UserConfigFnObject
export function defineConfig(config: UserConfigExport): UserConfigExport
export function defineConfig(config: UserConfigExport): UserConfigExport {
  return config
}

export function defineProject(config: UserWorkspaceConfig): UserWorkspaceConfig
export function defineProject(config: Promise<UserWorkspaceConfig>): Promise<UserWorkspaceConfig>
export function defineProject(config: UserProjectConfigFn): UserProjectConfigFn
export function defineProject(config: UserProjectConfigExport): UserProjectConfigExport
export function defineProject(config: UserProjectConfigExport): UserProjectConfigExport {
  return config
}

type WorkspaceProjectConfiguration = string | (UserProjectConfigExport & {
  /**
   * Relative path to the extendable config. All other options will be merged with this config.
   * @example '../vite.config.ts'
   */
  extends?: string
})

export function defineWorkspace(config: WorkspaceProjectConfiguration[]): WorkspaceProjectConfiguration[] {
  return config
}
