import { WorkerContext } from '../types'
import { collectTests } from './collect'
import { setupEnv } from './env'
import { createRunnerContext, runFiles } from './run'

export async function run({ files, config }: WorkerContext) {
  await setupEnv(config)

  const filesMap = await collectTests(files)

  const ctx = await createRunnerContext(config)

  Object.assign(ctx.filesMap, filesMap)

  await runFiles(filesMap, ctx)
}
