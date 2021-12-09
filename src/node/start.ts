import { VitestContext } from '../types'
import { createWorkerPool } from './pool'
import { globTestFiles } from './glob'
import { startWatcher } from './watcher'

// TODO: make it configurable (and disablable)
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

  const pool = createWorkerPool(Math.min(testFilepaths.length, MAX_WORKERS), ctx)

  await pool.runTestFiles(testFilepaths)

  await ctx.reporter.onFinished?.(ctx.state.getFiles())

  if (config.watch)
    await startWatcher(ctx, pool)
  else
    await pool.close()
}
