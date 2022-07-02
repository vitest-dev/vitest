import fs from 'fs'
import { findUp } from 'find-up'
import { resolve } from 'pathe'
import { loadConfigFromFile } from 'vite'
import { configFiles } from '../../constants'
import type { CliOptions } from '../cli-api'
import { slash } from '../../utils'

export class VitestCache {
  static resolveCacheDir(root: string, dir: string | undefined) {
    return resolve(root, slash(dir || 'node_modules/.vitest'))
  }

  static async clearCache(options: CliOptions) {
    const root = resolve(options.root || process.cwd())

    const configPath = options.config
      ? resolve(root, options.config)
      : await findUp(configFiles, { cwd: root } as any)

    const config = await loadConfigFromFile({ command: 'serve', mode: 'test' }, configPath)

    if (!config)
      throw new Error(`[vitest] Not able to load config from ${configPath}`)

    const cache = config.config.test?.cache

    if (cache === false)
      throw new Error('[vitest] Cache is disabled')

    const cachePath = VitestCache.resolveCacheDir(root, cache?.dir)

    let cleared = false

    if (fs.existsSync(cachePath)) {
      fs.rmSync(cachePath, { recursive: true, force: true })
      cleared = true
    }
    return { dir: cachePath, cleared }
  }
}
