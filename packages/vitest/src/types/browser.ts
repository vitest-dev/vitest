import type { TestExecutionMethod } from './worker'

/**
 * @internal
 */
export interface BrowserTesterOptions {
  method: TestExecutionMethod
  files: string[]
  providedContext: string
}
