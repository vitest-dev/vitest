/* eslint-disable unused-imports/no-unused-vars */

import type { HookHandler } from 'vite'
import type { InlineConfig, ResolvedConfig } from './config'
import type { VitestPluginContext } from './plugin'

type VitestInlineConfig = InlineConfig
type VitestResolvedConfig = ResolvedConfig

declare module 'vite' {
  interface UserConfig {
    /**
     * Options for Vitest
     */
    test?: VitestInlineConfig
  }

  interface ResolvedConfig {
    /**
     * Options for Vitest
     */
    test: VitestResolvedConfig
  }

  interface Plugin<A = any> {
    configureVitest?: HookHandler<(context: VitestPluginContext) => void>
  }
}

export {}
