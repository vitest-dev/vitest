import crypto from 'node:crypto'
import { resolve } from 'pathe'
import { slash } from '../../utils'
import { FilesStatsCache } from './files'
import { ResultsCache } from './results'

export class VitestCache {
  results = new ResultsCache()
  stats = new FilesStatsCache()

  getFileTestResults(key: string) {
    return this.results.getResults(key)
  }

  getFileStats(key: string) {
    return this.stats.getStats(key)
  }

  static resolveCacheDir(root: string, dir?: string, projectName?: string) {
    const baseDir = slash(dir || 'node_modules/.vite/vitest')
    return projectName
      ? resolve(root, baseDir, crypto.createHash('md5').update(projectName, 'utf-8').digest('hex'))
      : resolve(root, baseDir)
  }
}
