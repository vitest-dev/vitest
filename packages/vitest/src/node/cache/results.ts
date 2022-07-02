import fs from 'fs'
import { dirname, resolve } from 'pathe'
import type { File, ResolvedConfig } from '../../types'
import { version } from '../../../package.json'

export interface SuiteResultCache {
  failed: boolean
  duration: number
}

export class ResultsCache {
  private cache = new Map<string, SuiteResultCache>()
  private cachePath: string | null = null
  private version: string = version

  setConfig(config: ResolvedConfig['cache']) {
    if (config)
      this.cachePath = resolve(config.dir, 'results.json')
  }

  getResults(id: string) {
    return this.cache.get(id)
  }

  async readFromCache() {
    if (!this.cachePath)
      return

    if (fs.existsSync(this.cachePath)) {
      const resultsCache = await fs.promises.readFile(this.cachePath, 'utf8')
      const { results, version } = JSON.parse(resultsCache)
      this.cache = new Map(results)
      this.version = version
    }
  }

  updateResults(files: File[]) {
    files.forEach((file) => {
      const result = file.result
      if (!result)
        return
      const duration = result.duration || 0
      this.cache.set(file.filepath, {
        duration: duration >= 0 ? duration : 0,
        failed: result.state === 'fail',
      })
    })
  }

  removeFromCache(filepath: string) {
    this.cache.delete(filepath)
  }

  async writeToCache() {
    if (!this.cachePath)
      return

    const resultsCache = Array.from(this.cache.entries())

    const cacheDirname = dirname(this.cachePath)

    if (!fs.existsSync(cacheDirname))
      await fs.promises.mkdir(cacheDirname, { recursive: true })

    await fs.promises.writeFile(this.cachePath, JSON.stringify({
      version: this.version,
      results: resultsCache,
    }))
  }
}
