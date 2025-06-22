import type { ConfigEnv, UserConfig as ViteUserConfig } from 'vite'

import type {
  TestProjectConfiguration,
  TestProjectInlineConfiguration,
  UserConfig,
  UserProjectConfigExport,
  UserProjectConfigFn,
  UserWorkspaceConfig,
} from '../node/types/config'
import '../node/types/vite'

export { extraInlineDeps } from '../constants'
// will import vitest declare test in module 'vite'
export {
  configDefaults,
  coverageConfigDefaults,
  defaultBrowserPort,
  defaultExclude,
  defaultInclude,
} from '../defaults'
export type { WatcherTriggerPattern } from '../node/watcher'
export { mergeConfig } from 'vite'
export type { Plugin } from 'vite'

export type { ConfigEnv, UserConfig as TestUserConfig, ViteUserConfig }
export type {
  TestProjectConfiguration,
  TestProjectInlineConfiguration,
  UserProjectConfigExport,
  UserProjectConfigFn,
  UserWorkspaceConfig,
}
export type ViteUserConfigFnObject = (env: ConfigEnv) => ViteUserConfig
export type ViteUserConfigFnPromise = (env: ConfigEnv) => Promise<ViteUserConfig>
export type ViteUserConfigFn = (
  env: ConfigEnv
) => ViteUserConfig | Promise<ViteUserConfig>
export type ViteUserConfigExport =
  | ViteUserConfig
  | Promise<ViteUserConfig>
  | ViteUserConfigFnObject
  | ViteUserConfigFnPromise
  | ViteUserConfigFn

export function defineConfig(config: ViteUserConfig): ViteUserConfig
export function defineConfig(
  config: Promise<ViteUserConfig>
): Promise<ViteUserConfig>
export function defineConfig(config: ViteUserConfigFnObject): ViteUserConfigFnObject
export function defineConfig(config: ViteUserConfigExport): ViteUserConfigExport
export function defineConfig(config: ViteUserConfigExport): ViteUserConfigExport {
  return config
}

export function defineProject(config: UserWorkspaceConfig): UserWorkspaceConfig
export function defineProject(config: Promise<UserWorkspaceConfig>): Promise<UserWorkspaceConfig>
export function defineProject(config: UserProjectConfigFn): UserProjectConfigFn
export function defineProject(config: UserProjectConfigExport): UserProjectConfigExport
export function defineProject(config: UserProjectConfigExport): UserProjectConfigExport {
  return config
}
