import { defineConfig } from 'vitest/config'
import type { TestSpecification } from 'vitest/node'

class TestNameSequencer {
  async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    return [...files].sort((a, b) => {
      if (a.moduleId > b.moduleId)
        return 1

      if (a.moduleId < b.moduleId)
        return -1

      return 0
    })
  }

  public async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
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
      instances: [],
    },
  },
})
