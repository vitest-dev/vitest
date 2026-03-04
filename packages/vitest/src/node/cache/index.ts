import type { Logger } from '../logger'
import type { SuiteResultCache } from './results'
import { slash } from '@vitest/utils/helpers'
import { resolve } from 'pathe'
import { hash } from '../hash'
import { FilesStatsCache } from './files'
import { ResultsCache } from './results'

export class VitestCache {
  results: ResultsCache
  stats: FilesStatsCache = new FilesStatsCache()

  constructor(logger: Logger) {
    this.results = new ResultsCache(logger)
  }

  getFileTestResults(key: string): SuiteResultCache | undefined {
    return this.results.getResults(key)
  }

  getFileStats(key: string): {
    size: number
  } | undefined {
    return this.stats.getStats(key)
  }

  static resolveCacheDir(root: string, dir?: string, projectName?: string): string {
    const baseDir = slash(dir || 'node_modules/.vite')
    return resolve(
      root,
      baseDir,
      'vitest',
      hash('sha1', projectName || '', 'hex'),
    )
  }
}
