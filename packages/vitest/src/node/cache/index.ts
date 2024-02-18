import fs from 'node:fs'
import crypto from 'node:crypto'
import { findUp } from 'find-up'
import { resolve } from 'pathe'
import { loadConfigFromFile } from 'vite'
import { configFiles } from '../../constants'
import type { CliOptions } from '../cli/cli-api'
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

  static resolveCacheDir(dir: string, projectName: string | undefined) {
    return projectName
      ? resolve(dir, crypto.createHash('md5').update(projectName, 'utf-8').digest('hex'))
      : dir
  }

  static async clearCache(options: CliOptions) {
    const root = resolve(options.root || process.cwd())

    const configPath = options.config === false
      ? false
      : options.config
        ? resolve(root, options.config)
        : await findUp(configFiles, { cwd: root } as any)

    const config = configPath
      ? (await loadConfigFromFile({ command: 'serve', mode: 'test' }, configPath))?.config
      : undefined

    const cache = config?.test?.cache
    const projectName = config?.test?.name

    if (cache === false)
      throw new Error('Cache is disabled')

    const cachePath = VitestCache.resolveCacheDir(config!.cacheDir!, projectName)

    let cleared = false

    if (fs.existsSync(cachePath)) {
      fs.rmSync(cachePath, { recursive: true, force: true })
      cleared = true
    }
    return { dir: cachePath, cleared }
  }
}
