import fs from 'fs'
import { dirname, resolve } from 'pathe'
import type { File, ResolvedConfig } from '../types'
import { version } from '../../package.json'

interface SuiteResultCache {
  failed: boolean
  duration: number
}

export class ResultsCache {
  private cache = new Map<string, SuiteResultCache>()
  public config!: ResolvedConfig['cache']

  setConfig(config: ResolvedConfig['cache']) {
    this.config = config
  }

  getResults(id: string) {
    return this.cache.get(id)
  }

  async readFromCache() {
    if (this.config === false)
      return

    const resultsCachePath = resolve(this.config.path, 'results.json')
    if (fs.existsSync(resultsCachePath)) {
      const resultsCache = await fs.promises.readFile(resultsCachePath, 'utf8')
      this.cache = new Map(JSON.parse(resultsCache).results)
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
    if (this.config === false)
      return

    const resultsCachePath = resolve(this.config.path, 'results.json')
    const resultsCache = Array.from(this.cache.entries())

    const cacheDirname = dirname(resultsCachePath)

    if (!fs.existsSync(cacheDirname))
      await fs.promises.mkdir(cacheDirname, { recursive: true })

    await fs.promises.writeFile(resultsCachePath, JSON.stringify({
      version,
      results: resultsCache,
    }))
  }
}
