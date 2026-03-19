import type { Logger } from '../logger'
import type { ResolvedConfig } from '../types/config'
import fs, { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { dirname, relative, resolve } from 'pathe'
import { Vitest } from '../core'

export interface StaleManifestData {
  version: string
  timestamp: number
  files: Record<string, { mtimeMs: number }>
}

export class StaleManifest {
  private manifest: StaleManifestData | null = null
  private cachePath: string | null = null
  private version: string
  private root = '/'

  constructor(private logger: Logger) {
    this.version = Vitest.version
  }

  public getCachePath(): string | null {
    return this.cachePath
  }

  setConfig(root: string, config: ResolvedConfig['cache']): void {
    this.root = root
    if (config) {
      this.cachePath = resolve(config.dir, 'stale.json')
    }
  }

  async clearCache(): Promise<void> {
    if (this.cachePath && existsSync(this.cachePath)) {
      await rm(this.cachePath, { force: true, recursive: true })
      this.logger.log('[cache] cleared stale manifest at', this.cachePath)
    }
    this.manifest = null
  }

  async readFromCache(): Promise<void> {
    if (!this.cachePath) {
      return
    }

    if (!fs.existsSync(this.cachePath)) {
      return
    }

    const staleData = await fs.promises.readFile(this.cachePath, 'utf8')
    const parsed = JSON.parse(staleData || '{}') as StaleManifestData
    const [major, minor] = parsed.version?.split('.') || ['0', '0']

    // handling changed in 0.30.0
    if (Number(major) > 0 || Number(minor) >= 30) {
      this.manifest = parsed
      this.version = parsed.version
    }
  }

  async writeToCache(): Promise<void> {
    if (!this.cachePath || !this.manifest) {
      return
    }

    const cacheDirname = dirname(this.cachePath)

    if (!fs.existsSync(cacheDirname)) {
      await fs.promises.mkdir(cacheDirname, { recursive: true })
    }

    const cache = JSON.stringify({
      version: this.version,
      timestamp: this.manifest.timestamp,
      files: this.manifest.files,
    })

    await fs.promises.writeFile(this.cachePath, cache)
  }

  getFileMtime(relativePath: string): number | undefined {
    if (!this.manifest) {
      return undefined
    }
    return this.manifest.files[relativePath]?.mtimeMs
  }

  async updateFiles(root: string, filePaths: string[]): Promise<void> {
    if (!this.manifest) {
      this.manifest = {
        version: this.version,
        timestamp: Date.now(),
        files: {},
      }
    }

    for (const filePath of filePaths) {
      try {
        const stats = await fs.promises.stat(filePath)
        const relativePath = relative(root, filePath)
        this.manifest.files[relativePath] = {
          mtimeMs: stats.mtimeMs,
        }
      }
      catch {
        // file may have been deleted, skip
      }
    }

    this.manifest.timestamp = Date.now()
  }

  hasManifest(): boolean {
    return this.manifest !== null
  }
}
