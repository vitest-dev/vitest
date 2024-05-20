import fs from 'node:fs'
import type { Stats } from 'node:fs'
import { relative } from 'pathe'
import type { WorkspaceSpec } from '../pool'

type FileStatsCache = Pick<Stats, 'size'>

export class FilesStatsCache {
  public cache = new Map<string, FileStatsCache>()

  public getStats(key: string): FileStatsCache | undefined {
    return this.cache.get(key)
  }

  public async populateStats(root: string, specs: WorkspaceSpec[]) {
    const promises = specs.map(({ project, file }) => {
      const key = `${project.getName()}:${relative(root, file)}`
      return this.updateStats(file, key)
    })
    await Promise.all(promises)
  }

  public async updateStats(fsPath: string, key: string) {
    if (!fs.existsSync(fsPath))
      return
    const stats = await fs.promises.stat(fsPath)
    this.cache.set(key, { size: stats.size })
  }

  public removeStats(fsPath: string) {
    this.cache.forEach((_, key) => {
      if (key.endsWith(fsPath))
        this.cache.delete(key)
    })
  }
}
