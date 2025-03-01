import type { TestModule } from '../reporters/reported-tasks'

export interface TestRunResult {
  testModules: TestModule[]
  unhandledErrors: unknown[]
}
