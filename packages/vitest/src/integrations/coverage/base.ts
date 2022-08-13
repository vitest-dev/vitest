import type { ExistingRawSourceMap, TransformPluginContext } from 'rollup'

import type { Vitest } from '../../node'
import type { ResolvedCoverageOptions } from '../../types'

export interface CoverageProvider {
  name: string
  initialize(ctx: Vitest): Promise<void> | void

  resolveOptions(): ResolvedCoverageOptions
  clean(clean?: boolean): void | Promise<void>

  onBeforeFilesRun?(): void | Promise<void>
  onAfterSuiteRun(collectedCoverage: any): void | Promise<void>

  reportCoverage(): void | Promise<void>

  onFileTransform?(
    sourceCode: string,
    id: string,
    pluginCtx: TransformPluginContext
  ): void | { code: string; map: ExistingRawSourceMap }
}
