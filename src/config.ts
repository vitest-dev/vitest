import { UserConfig } from 'vite'
import { UserOptions } from './types'

export interface VitestConfig extends UserConfig {
  /**
   * Options for Vitest
   */
  test?: UserOptions
}

export function defineConfig(config: VitestConfig) {
  return config
}

declare module 'vite' {
  interface UserConfig {
    /**
     * Options for Vitest
     */
    test?: UserOptions
  }
}
