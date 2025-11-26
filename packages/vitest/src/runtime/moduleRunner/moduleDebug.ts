export type ModuleExecutionInfo = Map<string, ModuleExecutionInfoEntry>

export interface ModuleExecutionInfoEntry {
  startOffset: number

  /** The duration that was spent executing the module. */
  duration: number

  /** The time that was spent executing the module itself and externalized imports. */
  selfTime: number

  external?: boolean
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

const performanceNow = performance.now.bind(performance)

export class ModuleDebug {
  private executionStack: ExecutionStack = []

  startCalculateModuleExecutionInfo(filename: string, startOffset: number, external?: boolean): () => ModuleExecutionInfoEntry {
    const startTime = performanceNow()

    this.executionStack.push({
      filename,
      startTime,
      subImportTime: 0,
    })

    return () => {
      const duration = performanceNow() - startTime

      const currentExecution = this.executionStack.pop()

      if (currentExecution == null) {
        throw new Error('Execution stack is empty, this should never happen')
      }

      const selfTime = duration - currentExecution.subImportTime

      if (this.executionStack.length > 0) {
        this.executionStack.at(-1)!.subImportTime += duration
      }

      return {
        startOffset,
        external,
        duration,
        selfTime,
      }
    }
  }
}
