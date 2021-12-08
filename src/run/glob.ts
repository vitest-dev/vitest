import fg from 'fast-glob'
import { ResolvedConfig } from '../types'
import { defaultIncludes, defaultExcludes } from '../constants'

export async function globTestFiles(config: ResolvedConfig) {
  let testFilepaths = await fg(
    config.includes || defaultIncludes,
    {
      absolute: true,
      cwd: config.root,
      ignore: config.excludes || defaultExcludes,
    },
  )

  // if name filters are provided by the CLI
  if (config.filters?.length)
    testFilepaths = testFilepaths.filter(i => config.filters!.some(f => i.includes(f)))

  return testFilepaths
}
