import type {
  SnapshotResult,
  SnapshotStateOptions,
  SnapshotSummary,
} from './types'
import { basename, dirname, isAbsolute, join, resolve } from 'pathe'

export class SnapshotManager {
  public summary!: SnapshotSummary
  public extension = '.snap'

  constructor(
    public options: Omit<SnapshotStateOptions, 'snapshotEnvironment'>,
  ) {
    this.clear()
  }

  clear(): void {
    this.summary = emptySummary(this.options)
  }

  add(result: SnapshotResult): void {
    addSnapshotResult(this.summary, result)
  }

  resolvePath<T = any>(testPath: string, context?: T): string {
    const resolver
      = this.options.resolveSnapshotPath || (() => {
        return join(
          join(dirname(testPath), '__snapshots__'),
          `${basename(testPath)}${this.extension}`,
        )
      })

    const path = resolver(testPath, this.extension, context)
    return path
  }

  resolveRawPath(testPath: string, rawPath: string): string {
    return isAbsolute(rawPath) ? rawPath : resolve(dirname(testPath), rawPath)
  }
}

export function emptySummary(
  options: Omit<SnapshotStateOptions, 'snapshotEnvironment'>,
): SnapshotSummary {
  const summary = {
    added: 0,
    failure: false,
    filesAdded: 0,
    filesRemoved: 0,
    filesRemovedList: [],
    filesUnmatched: 0,
    filesUpdated: 0,
    matched: 0,
    total: 0,
    unchecked: 0,
    uncheckedKeysByFile: [],
    unmatched: 0,
    updated: 0,
    didUpdate: options.updateSnapshot === 'all',
  }
  return summary
}

export function addSnapshotResult(
  summary: SnapshotSummary,
  result: SnapshotResult,
): void {
  if (result.added) {
    summary.filesAdded++
  }
  if (result.fileDeleted) {
    summary.filesRemoved++
  }
  if (result.unmatched) {
    summary.filesUnmatched++
  }
  if (result.updated) {
    summary.filesUpdated++
  }

  summary.added += result.added
  summary.matched += result.matched
  summary.unchecked += result.unchecked
  if (result.uncheckedKeys && result.uncheckedKeys.length > 0) {
    summary.uncheckedKeysByFile.push({
      filePath: result.filepath,
      keys: result.uncheckedKeys,
    })
  }

  summary.unmatched += result.unmatched
  summary.updated += result.updated
  summary.total
    += result.added + result.matched + result.unmatched + result.updated
}
