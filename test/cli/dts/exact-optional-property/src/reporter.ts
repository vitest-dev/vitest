import type { File } from '@vitest/runner'
import { DefaultReporter } from 'vitest/reporters'

export class MyReporter extends DefaultReporter {
  override reportTestSummary(files: File[], errors: unknown[], leakCount: number): void {
    super.reportTestSummary(files, errors, leakCount)
  }
}
