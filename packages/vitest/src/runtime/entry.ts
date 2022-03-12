import { promises as fs } from 'fs'
import type { BuiltinEnvironment, ResolvedConfig } from '../types'
import { setupGlobalEnv, withEnv } from './setup'
import { startTests } from './run'

export async function run(
  files: string[],
  config: ResolvedConfig,
): Promise<void> {
  await setupGlobalEnv(config)

  // batch files and send them using onPathsCollected
  const webFiles: string[] = []

  for (const file of files) {
    if (config.web) {
      webFiles.push(file)
      continue
    }

    const code = await fs.readFile(file, 'utf-8')

    const env
      = code.match(/@(?:vitest|jest)-environment\s+?([\w-]+)\b/)?.[1]
      || config.environment
      || 'node'

    if (!['node', 'jsdom', 'happy-dom'].includes(env))
      throw new Error(`Unsupported environment: ${env}`)

    __vitest_worker__.filepath = file

    await withEnv(
      env as BuiltinEnvironment,
      config.environmentOptions || {},
      async() => {
        await startTests([file], config)
      },
    )

    __vitest_worker__.filepath = undefined
  }

  if (config.web)
    await startTests(webFiles, config)
}
