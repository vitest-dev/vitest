import { defineConfig } from 'vite'
import { BaseSequencer } from 'vitest/node'

export default defineConfig({
  test: {
    threads: false,
    sequence: {
      sequencer: class Sequences extends BaseSequencer {
        public async sort(files: string[]): Promise<string[]> {
          return files.sort()
        }
      },
    },
  },
})
