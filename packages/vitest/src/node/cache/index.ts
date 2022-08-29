import fs from 'fs'
import { findUp } from 'find-up'
import { resolve } from 'pathe'
import { loadConfigFromFile } from 'vite'
import { configFiles } from '../../constants'
import type { CliOptions } from '../cli-api'
import { slash } from '../../utils'
import { FilesStatsCache } from './files'
import { ResultsCache } from './results'

export class VitestCache {
  results = new ResultsCache()
  stats = new FilesStatsCache()

  getFileTestResults(id: string) {
    return this.results.getResults(id)
  }

  getFileStats(id: string) {
    return this.stats.getStats(id)
  }

  static resolveCacheDir(root: string, dir: string | undefined) {
    return resolve(root, slash(dir || 'node_modules/.vitest'))
  }

  static async clearCache(options: CliOptions) {
    const root = resolve(options.root || process.cwd())

    const configPath = options.config
      ? resolve(root, options.config)
      : await findUp(configFiles, { cwd: root } as any)

    const config = await loadConfigFromFile({ command: 'serve', mode: 'test' }, configPath)

    const cache = config?.config.test?.cache

    if (cache === false)
      throw new Error('Cache is disabled')

    const cachePath = VitestCache.resolveCacheDir(root, cache?.dir)

    let cleared = false

    if (fs.existsSync(cachePath)) {
      fs.rmSync(cachePath, { recursive: true, force: true })
      cleared = true
    }
    return { dir: cachePath, cleared }
  }
}
