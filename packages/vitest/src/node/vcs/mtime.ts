import type { VCSProvider, VCSProviderOptions } from './vcs'
import { stat } from 'node:fs/promises'

/**
 * Reports a dependency as changed when its modification time is newer than the run that recorded it.
 * A dependency without a recorded time is always changed.
 */
export class MtimeVCSProvider implements VCSProvider {
  async findChangedFiles(options: VCSProviderOptions): Promise<string[]> {
    const dependencies = await options.resolver.getDependencies()
    const changed = await Promise.all(
      dependencies.map(async ({ file, recordedAt }) => {
        if (recordedAt == null) {
          return file
        }
        const stats = await stat(file).catch(() => null)
        return !stats || stats.mtimeMs > recordedAt ? file : null
      }),
    )
    return changed.filter((file) => file != null)
  }
}
