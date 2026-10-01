import type { SerializedConfig } from 'vitest'

export type RunState = 'idle' | 'running'

export interface BrowserRunnerState {
  files: string[]
  config: SerializedConfig
  type: 'orchestrator'
  provider: string
  wrapModule: <T>(module: () => T) => T
}
