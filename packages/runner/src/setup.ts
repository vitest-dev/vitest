import { toArray } from '@vitest/utils'
import type { VitestRunner, VitestRunnerConfig } from './types'

export async function runSetupFiles(config: VitestRunnerConfig, runner: VitestRunner) {
  const files = toArray(config.setupFiles)
  if (config.sequence.setupFiles === 'parallel') {
    await Promise.all(
      files.map(async (fsPath) => {
        await runner.importFile(fsPath, 'setup')
      }),
    )
  }
  else {
    for (const fsPath of files)
      await runner.importFile(fsPath, 'setup')
  }
}

export async function loadDiffOptionFile(config: VitestRunnerConfig, runner: VitestRunner) {
  if (typeof config.diff !== 'string')
    return

  const diffModule = await runner.importFile(config.diff, 'diff') as any

  if (diffModule && typeof diffModule.default === 'object' && diffModule.default != null)
    runner.config.diff = diffModule.default
  else
    throw new Error(`invalid diff config file ${config.diff}. Must have a default export with config object`)
}
