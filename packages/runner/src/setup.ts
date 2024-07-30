import type { VitestRunner, VitestRunnerConfig } from './types/runner'

export async function runSetupFiles(
  config: VitestRunnerConfig,
  files: string[],
  runner: VitestRunner,
): Promise<void> {
  if (config.sequence.setupFiles === 'parallel') {
    await Promise.all(
      files.map(async (fsPath) => {
        await runner.importFile(fsPath, 'setup')
      }),
    )
  }
  else {
    for (const fsPath of files) {
      await runner.importFile(fsPath, 'setup')
    }
  }
}
