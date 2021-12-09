import { ResolvedConfig } from '../types'
import { setupEnv } from './env'
import { startTests } from './run'

export async function run(files: string[], config: ResolvedConfig): Promise<void> {
  await setupEnv(config)
  await startTests(files)
}
