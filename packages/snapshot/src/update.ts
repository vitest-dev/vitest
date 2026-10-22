import type { InlineSnapshot } from './port/inlineSnapshot'
import type { RawSnapshot } from './port/rawSnapshot'
import type { SnapshotData, SnapshotEnvironment } from './types'
import { saveInlineSnapshots } from './port/inlineSnapshot'
import { saveRawSnapshots } from './port/rawSnapshot'
import { evaluateSnapshotFile, saveSnapshotFile } from './port/utils'

interface InlineSnapshotUpdate extends InlineSnapshot {
  type: 'inline'
}

interface FileSnapshotUpdate {
  type: 'file'
  file: string
  key: string
  snapshot: string
}

interface RawSnapshotUpdate extends RawSnapshot {
  type: 'raw'
}

export type SnapshotUpdate = InlineSnapshotUpdate | FileSnapshotUpdate | RawSnapshotUpdate

export async function saveSnapshotUpdates(
  snapshots: Map<SnapshotEnvironment, readonly SnapshotUpdate[]>,
  trackFS: (
    filepath: string,
    options?: {
      timeout?: number
      type: 'change'
    },
  ) => Promise<void>,
): Promise<void> {
  const updatesByFile = new Map<string, SnapshotUpdate[]>()
  const fsEvents: Promise<void>[] = []

  for (const [environment, updates] of snapshots) {
    for (const update of updates) {
      const fileUpdates = updatesByFile.get(update.file) ?? []

      if (fileUpdates.length === 0) {
        updatesByFile.set(update.file, fileUpdates)
      }

      fileUpdates.push(update)
    }

    for (const [file, fileUpdates] of updatesByFile) {
      const updates = Object.groupBy(fileUpdates.values(), (snapshot) => snapshot.type) as {
        inline?: InlineSnapshotUpdate[]
        file?: FileSnapshotUpdate[]
        raw?: RawSnapshotUpdate[]
      }

      fsEvents.push(trackFS(file, { type: 'change', timeout: 500 }))

      if (updates.inline) {
        saveInlineSnapshots(environment, updates.inline)
      }

      if (updates.file) {
        let data: SnapshotData | null

        if (environment.readSnapshotFileData) {
          data = await environment.readSnapshotFileData(file)
        } else {
          const content = await environment.readSnapshotFile(file)
          data = content == null ? null : evaluateSnapshotFile(file, content)
        }

        const snapshotData: SnapshotData = Object.assign(Object.create(null), data)

        for (const snapshot of updates.file) {
          snapshotData[snapshot.key] = snapshot.snapshot
        }

        saveSnapshotFile(environment, snapshotData, file)
      }

      if (updates.raw) {
        saveRawSnapshots(environment, updates.raw)
      }
    }
  }

  await Promise.all(fsEvents)
}
