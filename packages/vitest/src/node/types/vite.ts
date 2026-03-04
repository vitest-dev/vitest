/* eslint-disable unused-imports/no-unused-vars */

import type { HookHandler } from 'vite'
import type { InlineConfig } from './config'
import type { VitestPluginContext } from './plugin'

type VitestInlineConfig = InlineConfig

declare module 'vite' {
  interface UserConfig {
    /**
     * Options for Vitest
     */
    test?: VitestInlineConfig
  }

  interface Plugin<A = any> {
    configureVitest?: HookHandler<(context: VitestPluginContext) => void>
  }
}

export {}
