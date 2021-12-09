import { DefaultReporter } from '../reporters/default'
import { ResolvedConfig, File } from '../types'
import { createWorker } from '../worker/manager'
import { globTestFiles } from './glob'

export interface TestState {
  filesMap: Record<string, File>
}

export async function start(config: ResolvedConfig) {
  const reporter = config.reporter || new DefaultReporter(config)
  const testFilepaths = await globTestFiles(config)
  if (!testFilepaths.length) {
    console.error('No test files found')
    process.exitCode = 1
    return
  }

  await reporter.onStart?.(config)

  // TODO: POOL
  await Promise.all(
    testFilepaths.map(async(path) => {
      return await createWorker({
        config,
        files: [path],
        reporter,
      })
    }),
  )

  await reporter.onFinished?.(Object.values(process.__vitest__.state.filesMap))

  // TODO: Watcher
  // TODO: terminate
}
