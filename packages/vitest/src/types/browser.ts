import type { TestExecutionMethod } from './worker'

export interface BrowserTesterOptions {
  method: TestExecutionMethod
  files: string[]
  providedContext: string
  startTime: number
}
