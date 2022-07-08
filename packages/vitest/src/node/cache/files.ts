import fs from 'fs'
import type { Stats } from 'fs'

type FileStatsCache = Pick<Stats, 'size'>

export class FilesStatsCache {
  public cache = new Map<string, FileStatsCache>()

  public getStats(fsPath: string): FileStatsCache | undefined {
    return this.cache.get(fsPath)
  }

  public async updateStats(fsPath: string) {
    if (!fs.existsSync(fsPath))
      return

    const stats = await fs.promises.stat(fsPath)
    this.cache.set(fsPath, { size: stats.size })
  }

  public removeStats(fsPath: string) {
    this.cache.delete(fsPath)
  }
}
