import type { File } from '@vitest/runner'
import type { ResolvedConfig } from '../types/config'
import fs from 'node:fs'
import { dirname, relative, resolve } from 'pathe'

export interface SuiteResultCache {
  failed: boolean
  duration: number
}

export class ResultsCache {
  private cache = new Map<string, SuiteResultCache>()
  private workspacesKeyMap = new Map<string, string[]>()
  private cachePath: string | null = null
  private version: string
  private root = '/'

  constructor(version: string) {
    this.version = version
  }

  public getCachePath() {
    return this.cachePath
  }

  setConfig(root: string, config: ResolvedConfig['cache']) {
    this.root = root
    if (config) {
      this.cachePath = resolve(config.dir, 'results.json')
    }
  }

  getResults(key: string) {
    return this.cache.get(key)
  }

  async readFromCache() {
    if (!this.cachePath) {
      return
    }

    if (!fs.existsSync(this.cachePath)) {
      return
    }

    const resultsCache = await fs.promises.readFile(this.cachePath, 'utf8')
    const { results, version } = JSON.parse(resultsCache || '[]')
    // handling changed in 0.30.0
    if (Number(version.split('.')[1]) >= 30) {
      this.cache = new Map(results)
      this.version = version
      results.forEach(([spec]: [string]) => {
        const [projectName, relativePath] = spec.split(':')
        const keyMap = this.workspacesKeyMap.get(relativePath) || []
        keyMap.push(projectName)
        this.workspacesKeyMap.set(relativePath, keyMap)
      })
    }
  }

  updateResults(files: File[]) {
    files.forEach((file) => {
      const result = file.result
      if (!result) {
        return
      }
      const duration = result.duration || 0
      // store as relative, so cache would be the same in CI and locally
      const relativePath = relative(this.root, file.filepath)
      this.cache.set(`${file.projectName || ''}:${relativePath}`, {
        duration: duration >= 0 ? duration : 0,
        failed: result.state === 'fail',
      })
    })
  }

  removeFromCache(filepath: string) {
    this.cache.forEach((_, key) => {
      if (key.endsWith(filepath)) {
        this.cache.delete(key)
      }
    })
  }

  async writeToCache() {
    if (!this.cachePath) {
      return
    }

    const results = Array.from(this.cache.entries())

    const cacheDirname = dirname(this.cachePath)

    if (!fs.existsSync(cacheDirname)) {
      await fs.promises.mkdir(cacheDirname, { recursive: true })
    }

    const cache = JSON.stringify({
      version: this.version,
      results,
    })

    await fs.promises.writeFile(this.cachePath, cache)
  }
}
