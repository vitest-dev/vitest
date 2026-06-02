import type { RunnerFile } from 'vitest'
import { DefaultReporter } from 'vitest/node'

export class MyReporter extends DefaultReporter {
  override reportTestSummary(files: RunnerFile[], errors: unknown[], leakCount: number): void {
    super.reportTestSummary(files, errors, leakCount)
  }
}
