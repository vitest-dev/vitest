import type { InlineConfig as VitestInlineConfig } from './config'

declare module 'vite' {
  interface UserConfig {
    /**
     * Options for Vitest
     */
    test?: VitestInlineConfig
  }
}

export {}
