import type { SerializedConfig } from '../config'
import type { VitestRunner } from './types'

export async function runSetupFiles(
  config: SerializedConfig,
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
