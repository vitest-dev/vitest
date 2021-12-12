import fg from 'fast-glob'
import mm from 'micromatch'
import type { ResolvedConfig } from '../types'

export function isTargetFile(id: string, config: ResolvedConfig): boolean {
  if (mm.isMatch(id, config.excludes))
    return false
  return mm.isMatch(id, config.includes)
}

export async function globTestFiles(config: ResolvedConfig) {
  let testFilepaths = await fg(
    config.includes,
    {
      absolute: true,
      cwd: config.root,
      ignore: config.excludes,
    },
  )

  // if name filters are provided by the CLI
  if (config.cliFilters?.length)
    testFilepaths = testFilepaths.filter(i => config.cliFilters!.some(f => i.includes(f)))

  return testFilepaths
}
