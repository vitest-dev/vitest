import { defineConfig } from 'vite'
import { BaseSequencer, type WorkspaceSpec } from 'vitest/node'

export default defineConfig({
  test: {
    pool: 'forks',
    sequence: {
      sequencer: class Sequences extends BaseSequencer {
        public async sort(files: WorkspaceSpec[]): Promise<WorkspaceSpec[]> {
          return files.sort()
        }
      },
    },
  },
})
