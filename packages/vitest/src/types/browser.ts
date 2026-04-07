import type { FileSpecification } from '@vitest/runner'
import type { OTELCarrier } from '../utils/traces'
import type { TestExecutionMethod } from './worker'

export interface BrowserTesterOptions {
  method: TestExecutionMethod
  files: FileSpecification[]
  providedContext: string
  otelCarrier?: OTELCarrier
}
