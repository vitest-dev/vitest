import { slash } from '@vitest/utils'
import { resolve } from 'pathe'
import { hash } from '../hash'
import { FilesStatsCache } from './files'
import { ResultsCache } from './results'

export class VitestCache {
  results: ResultsCache
  stats = new FilesStatsCache()

  constructor(version: string) {
    this.results = new ResultsCache(version)
  }

  getFileTestResults(key: string) {
    return this.results.getResults(key)
  }

  getFileStats(key: string) {
    return this.stats.getStats(key)
  }

  static resolveCacheDir(root: string, dir?: string, projectName?: string) {
    const baseDir = slash(dir || 'node_modules/.vite/vitest')
    return projectName
      ? resolve(
          root,
          baseDir,
          hash('md5', projectName, 'hex'),
        )
      : resolve(root, baseDir)
  }
}
