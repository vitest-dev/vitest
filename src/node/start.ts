import { DefaultReporter } from '../reporters/default'
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

  // TODO: POOL
  await createWorker({
    config,
    files: testFilepaths,
    reporter: config.reporter || new DefaultReporter(config),
  })

  // TODO: Watcher
  // TODO: terminate
}
