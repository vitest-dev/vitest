import type { File } from '@vitest/runner'
import { calculateSuiteHash, generateFileHash } from '@vitest/runner/utils'

/**
 * Rewrite file.id and all child task IDs so that the same test file run under
 * different blob labels produces a distinct entry in state.filesMap.
 *
 * Mirrors the `__typecheck__` pattern in typecheck/collect.ts:
 *   hash key = `${projectName}:__typecheck__`, file.meta.typecheck = true
 *
 * For blob labels:
 *   hash key = `${projectName} [${label}]`, file.meta.blobLabel = label
 */
export function applyBlobLabel(files: File[], label: string, projectName: string | undefined): void {
  for (const file of files) {
    const hashName = projectName ? `${projectName} [${label}]` : `[${label}]`
    file.id = generateFileHash(file.name, hashName)
    file.meta = { ...file.meta, blobLabel: label }
    // Recompute all child task IDs derived positionally from file.id
    calculateSuiteHash(file)
  }
}
