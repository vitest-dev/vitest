import type { FileSpecification } from '@vitest/runner'
import type { TestExecutionMethod } from './worker'

export interface BrowserTesterOptions {
  method: TestExecutionMethod
  files: FileSpecification[]
  providedContext: string
}
