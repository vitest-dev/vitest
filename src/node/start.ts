import { ResolvedConfig } from '../types'
import { createWorker } from '../worker/manager'
import { globTestFiles } from './glob'

export async function start(config: ResolvedConfig) {
  const testFilepaths = await globTestFiles(config)
  if (!testFilepaths.length) {
    console.error('No test files found')
    process.exitCode = 1
    return
  }

  await createWorker({ config, files: testFilepaths })

  // TODO: terminate
}
