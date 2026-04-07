import type { Awaitable } from '@vitest/utils'

export interface EnvironmentReturn {
  teardown: (global: any) => Awaitable<void>
}

export interface VmEnvironmentReturn {
  getVmContext: () => { [key: string]: any }
  teardown: () => Awaitable<void>
}

export interface Environment {
  name: string
  /**
   * @deprecated use `viteEnvironment` instead. Uses `name` by default
   */
  transformMode?: 'web' | 'ssr'
  /**
   * Environment initiated by the Vite server. It is usually available
   * as `vite.server.environments.${name}`.
   *
   * By default, fallbacks to `name`.
   */
  viteEnvironment?: 'client' | 'ssr' | ({} & string)
  setupVM?: (options: Record<string, any>) => Awaitable<VmEnvironmentReturn>
  setup: (
    global: any,
    options: Record<string, any>,
  ) => Awaitable<EnvironmentReturn>
}

export interface ResolvedTestEnvironment {
  environment: Environment
  options: Record<string, any> | null
}
