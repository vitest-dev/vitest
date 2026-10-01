import type { RunnerTestFile } from 'vitest'
import { DefaultReporter } from 'vitest/node'

export class MyReporter extends DefaultReporter {
  override reportTestSummary(files: RunnerTestFile[], errors: unknown[], leakCount: number): void {
    super.reportTestSummary(files, errors, leakCount)
  }
}
