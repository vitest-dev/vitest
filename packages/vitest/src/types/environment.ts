import type { Awaitable } from './general'

export interface EnvironmentReturn {
  teardown: (global: any) => Awaitable<void>
}

export interface VmEnvironmentReturn {
  getVmContext: () => { [key: string]: any }
  teardown: () => Awaitable<void>
}

export interface Environment {
  name: string
  transformMode: 'web' | 'ssr'
  setupVM?: (options: Record<string, any>) => Awaitable<VmEnvironmentReturn>
  setup: (
    global: any,
    options: Record<string, any>
  ) => Awaitable<EnvironmentReturn>
}

export interface ResolvedTestEnvironment {
  environment: Environment
  options: Record<string, any> | null
}
