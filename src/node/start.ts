import { VitestContext } from '../types'
import { createWorker } from './pool'
import { globTestFiles } from './glob'

const MAX_WORKERS = 20

export async function start(ctx: VitestContext) {
  const { config } = ctx
  const testFilepaths = await globTestFiles(config)
  if (!testFilepaths.length) {
    console.error('No test files found')
    process.exitCode = 1
    return
  }

  await ctx.reporter.onStart?.(config)

  const num = Math.min(testFilepaths.length, MAX_WORKERS)
  const workers = new Array(num).fill(0).map(() => createWorker(ctx))

  await Promise.all(workers.map(async(worker) => {
    await worker.untilReady()
    while (testFilepaths.length) {
      const task = testFilepaths.pop()
      if (task)
        await worker.run([task])
      else
        break
    }
  }))

  await ctx.reporter.onFinished?.(ctx.state.getFiles())

  await Promise.all(workers.map(worker => worker.close()))

  // TODO: Watcher
  // TODO: terminate
}
