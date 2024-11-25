import type { TestModule } from '../reporters'

export interface TestRunResult {
  tests: TestModule[]
  errors: unknown[]
}
