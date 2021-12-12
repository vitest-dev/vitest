import type { ResolvedConfig } from '../types'
import { setupGlobalEnv, withEnv } from './env'
import { startTests } from './run'

export async function run(files: string[], config: ResolvedConfig): Promise<void> {
  await setupGlobalEnv(config)

  await withEnv(config.environment, async() => {
    await startTests(files)
  })
}
