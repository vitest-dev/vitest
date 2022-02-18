import type { UserConfig } from 'vite'

export { configDefaults } from '../defaults'
export function defineConfig(config: UserConfig) {
  return config
}

export type { Vitest } from './core'
export { createVitest } from './create'
export { VitestPlugin } from './plugins'
