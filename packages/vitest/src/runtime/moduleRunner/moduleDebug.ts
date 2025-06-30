export type ModuleExecutionInfo = Map<string, ModuleExecutionInfoEntry>

export interface ModuleExecutionInfoEntry {
  startOffset: number

  /** The duration that was spent executing the module. */
  duration: number

  /** The time that was spent executing the module itself and externalized imports. */
  selfTime: number
}

/** Stack to track nested module execution for self-time calculation. */
export type ExecutionStack = Array<{
  /** The file that is being executed. */
  filename: string

  /** The start time of this module's execution. */
  startTime: number

  /** Accumulated time spent importing all sub-imports. */
  subImportTime: number
}>
