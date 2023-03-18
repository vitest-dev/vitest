import type { File, TaskResult, Test } from '@vitest/runner'
import type { VitestClient } from '@vitest/ws-client'
import type { ResolvedConfig } from '#types'

interface BrowserRunnerOptions {
  config: ResolvedConfig
  client: VitestClient
  browserHashMap: Map<string, string>
}

export function createBrowserRunner(original: any) {
  return class BrowserTestRunner extends original {
    public config: ResolvedConfig
    hasMap = new Map<string, string>()
    client: VitestClient

    constructor(options: BrowserRunnerOptions) {
      super(options.config)
      this.config = options.config
      this.hasMap = options.browserHashMap
      this.client = options.client
    }

    async onAfterRunTest(task: Test) {
      await super.onAfterRunTest?.()
      task.result?.errors?.forEach((error) => {
        console.error(error.message)
      })
    }

    onCollected(files: File[]): unknown {
      return this.client.rpc.onCollected(files)
    }

    onTaskUpdate(task: [string, TaskResult | undefined][]): Promise<void> {
      return this.client.rpc.onTaskUpdate(task)
    }

    async importFile(filepath: string) {
      const match = filepath.match(/^(\w:\/)/)
      const hash = this.hasMap.get(filepath)
      const importpath = match
        ? `/@fs/${filepath.slice(match[1].length)}?v=${hash}`
        : `${filepath}?v=${hash}`
      await import(importpath)
    }
  }
}
