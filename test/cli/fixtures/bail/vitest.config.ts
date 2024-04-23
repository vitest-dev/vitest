import { defineConfig } from 'vitest/config'
import type { WorkspaceSpec } from 'vitest/node'

class TestNameSequencer {
  async sort(files: WorkspaceSpec[]): Promise<WorkspaceSpec[]> {
    return [...files].sort(([, filenameA], [, filenameB]) => {
      if (filenameA > filenameB)
        return 1

      if (filenameA < filenameB)
        return -1

      return 0
    })
  }

  public async shard(files: WorkspaceSpec[]): Promise<WorkspaceSpec[]> {
    return files
  }
}

export default defineConfig({
  test: {
    reporters: 'verbose',
    cache: false,
    watch: false,
    sequence: {
      sequencer: TestNameSequencer,
    },
    browser: {
      headless: true,
      name: 'chrome',
    },
  },
})
