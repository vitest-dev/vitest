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
