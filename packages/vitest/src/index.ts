import type { InlineConfig } from './types'

export { suite, test, describe, it } from './runtime/suite'
export * from './runtime/hooks'
export * from './runtime/utils'

export { runOnce, isFirstRun } from './integrations/run-once'
export type { EnhancedSpy, MockedFunction, MockedObject, SpyInstance, SpyInstanceFn, SpyContext } from './integrations/spy'
export * from './integrations/chai'
export * from './integrations/vi'
export * from './integrations/utils'

export * from './types'
export * from './api/types'

type VitestInlineConfig = InlineConfig

declare module 'vite' {
  interface UserConfig {
    /**
     * Options for Vitest
     */
    test?: VitestInlineConfig
  }
}
