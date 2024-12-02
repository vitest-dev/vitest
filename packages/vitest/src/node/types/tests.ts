import type { TestModule } from '../reporters'

export interface TestRunResult {
  testModules: TestModule[]
  unhandledErrors: unknown[]
}
