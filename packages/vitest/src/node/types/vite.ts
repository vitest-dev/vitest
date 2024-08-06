import type { InlineConfig } from './config'

type VitestInlineConfig = InlineConfig

declare module 'vite' {
  interface UserConfig {
    /**
     * Options for Vitest
     */
    test?: VitestInlineConfig
  }
}

export {}
