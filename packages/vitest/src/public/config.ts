import '../node/types/vite'

import type { ConfigEnv, UserConfig as ViteUserConfig } from 'vite'
import type { UserProjectConfigExport, UserProjectConfigFn, UserWorkspaceConfig, WorkspaceProjectConfiguration } from '../node/types/config'

// will import vitest declare test in module 'vite'
export {
  defaultBrowserPort,
  configDefaults,
  defaultInclude,
  defaultExclude,
  coverageConfigDefaults,
} from '../defaults'
export { mergeConfig } from 'vite'
export { extraInlineDeps } from '../constants'
export type { Plugin } from 'vite'

export type { ConfigEnv, ViteUserConfig }
/**
 * @deprecated Use `ViteUserConfig` instead
 */
export type UserConfig = ViteUserConfig
export type { UserProjectConfigExport, UserProjectConfigFn, UserWorkspaceConfig, WorkspaceProjectConfiguration }
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

export function defineWorkspace(config: WorkspaceProjectConfiguration[]): WorkspaceProjectConfiguration[] {
  return config
}
