import type { File, TaskResult, Test } from '@vitest/runner'
import { rpc } from './rpc'
import type { ResolvedConfig } from '#types'

interface BrowserRunnerOptions {
  config: ResolvedConfig
  browserHashMap: Map<string, string>
}

interface CoverageHandler {
  takeCoverage: () => Promise<unknown>
}

export function createBrowserRunner(original: any, coverageModule: CoverageHandler | null) {
  return class BrowserTestRunner extends original {
    public config: ResolvedConfig
    hashMap = new Map<string, string>()

    constructor(options: BrowserRunnerOptions) {
      super(options.config)
      this.config = options.config
      this.hashMap = options.browserHashMap
    }

    async onAfterRunTest(task: Test) {
      await super.onAfterRunTest?.()
      task.result?.errors?.forEach((error) => {
        console.error(error.message)
      })
    }

    async onAfterRunSuite() {
      await super.onAfterRunSuite?.()
      const coverage = await coverageModule?.takeCoverage?.()
      await rpc().onAfterSuiteRun({ coverage })
    }

    onCollected(files: File[]): unknown {
      return rpc().onCollected(files)
    }

    onTaskUpdate(task: [string, TaskResult | undefined][]): Promise<void> {
      return rpc().onTaskUpdate(task)
    }

    async importFile(filepath: string) {
      const match = filepath.match(/^(\w:\/)/)
      let hash = this.hashMap.get(filepath)
      if (!hash) {
        hash = Date.now().toString()
        this.hashMap.set(filepath, hash)
      }
      const importpath = match
        ? `/@fs/${filepath.slice(match[1].length)}?v=${hash}`
        : `${filepath}?v=${hash}`
      await import(importpath)
    }
  }
}
