import type { VitestContext } from '../types'
import { hasFailed } from '../utils'
import { createPool } from './pool'
import { globTestFiles } from './glob'
import { startWatcher } from './watcher'

export async function start(ctx: VitestContext) {
  const { config } = ctx
  const testFilepaths = await globTestFiles(config)
  if (!testFilepaths.length) {
    console.error('No test files found')
    process.exitCode = 1
    return
  }


  const pool = createPool(ctx)

  process.on('beforeExit',async (code) => {
    await pool.close()

    console.log(`About to exit with code: ${code}`);
  });

  await pool.runTestFiles(testFilepaths)

  if (hasFailed(ctx.state.getFiles()))
    process.exitCode = 1

  await Promise.all(ctx.reporters.map(r => r.onFinished?.(ctx.state.getFiles())))

  if (config.watch)
    await startWatcher(ctx, pool)
  else
    await pool.close()
}
