import type { HookHandler } from 'vite'
import type { TestProject } from '../project'
import type { InlineConfig } from './config'

type VitestInlineConfig = InlineConfig

interface VitestPluginContext {
  project: TestProject
}

declare module 'vite' {
  interface UserConfig {
    /**
     * Options for Vitest
     */
    test?: VitestInlineConfig
  }

  // eslint-disable-next-line unused-imports/no-unused-vars
  interface Plugin<A = any> {
    configureVitest: HookHandler<(context: VitestPluginContext) => void>
  }
}

export {}
