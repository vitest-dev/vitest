import fg from 'fast-glob'
import mm from 'micromatch'
import type { ResolvedConfig } from '../types'

export function isTargetFile(id: string, config: ResolvedConfig): boolean {
  if (mm.isMatch(id, config.exclude))
    return false
  return mm.isMatch(id, config.include)
}

export async function globTestFiles(config: ResolvedConfig, filters?: string[]) {
  let files = await fg(
    config.include,
    {
      absolute: true,
      cwd: config.root,
      ignore: config.exclude,
    },
  )

  if (filters?.length)
    files = files.filter(i => filters.some(f => i.includes(f)))

  return files
}
