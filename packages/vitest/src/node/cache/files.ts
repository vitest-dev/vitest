import fs, { type Stats } from 'fs'

type FileCacheStats = Pick<Stats, 'size'>

export class FilesCache {
  public cache = new Map<string, FileCacheStats>()

  public getStats(fsPath: string): FileCacheStats | undefined {
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
