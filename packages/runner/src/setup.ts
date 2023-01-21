import { toArray } from '@vitest/utils'
import type { VitestRunner, VitestRunnerConfig } from './types'

export async function runSetupFiles(config: VitestRunnerConfig, runner: VitestRunner) {
  const files = toArray(config.setupFiles)
  await Promise.all(
    files.map(async (fsPath) => {
      // TODO: check if it's a setup file and remove
      // getWorkerState().moduleCache.delete(fsPath)
      await runner.importFile(fsPath, 'setup')
    }),
  )
}
