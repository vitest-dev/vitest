import type { SuiteResultCache } from './results'
import { slash } from '@vitest/utils'
import { resolve } from 'pathe'
import { hash } from '../hash'
import { FilesStatsCache } from './files'
import { ResultsCache } from './results'

export class VitestCache {
  results: ResultsCache
  stats: FilesStatsCache = new FilesStatsCache()

  constructor(version: string) {
    this.results = new ResultsCache(version)
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
