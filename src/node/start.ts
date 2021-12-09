import { DefaultReporter } from '../reporters/default'
import { VitestContext } from '../types'
import { createWorker } from './pool'
import { globTestFiles } from './glob'

export async function start(ctx: VitestContext) {
  const { config } = ctx
  const reporter = config.reporter || new DefaultReporter(ctx)
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
