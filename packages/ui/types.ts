import type { SerializedConfig } from 'vitest'

export interface WSMessage {
  /**
   * Message type
   */
  type: string

  /**
   * Message Data
   */
  data: any
}

export type RunState = 'idle' | 'running'

export interface BrowserRunnerState {
  files: string[]
  config: SerializedConfig
  type: 'orchestrator'
  wrapModule: <T>(module: () => T) => T
}
