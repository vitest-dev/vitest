import type { Vitest } from '../../node'
import type { ResolvedCoverageOptions } from '../../types'

export interface BaseCoverageProvider {
  // TODO: Maybe this could be just a constructor?
  initialize(ctx: Vitest): Promise<void> | void

  resolveOptions(): ResolvedCoverageOptions
  clean(clean?: boolean): void | Promise<void>

  onBeforeFilesRun?(): void | Promise<void>
  onAfterAllFilesRun(): void | Promise<void>
  onAfterSuiteRun(): void | Promise<void>
}
