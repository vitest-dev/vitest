import { WorkerContext } from '../types'
import { setupEnv } from './env'
import { startTests } from './run'

export async function run({ files, config }: WorkerContext) {
  await setupEnv(config)
  await startTests(files)
  // TODO: watch
}
