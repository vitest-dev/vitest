import type { CoverageProviderModule } from 'vitest/node'
import type { V8CoverageProvider } from './provider'
import { loadProvider } from './load-provider'

let enabled = false

function triggerCommand(command: string, args: any[] = []): Promise<any> {
  return (globalThis as any).__vitest_browser_runner__.commands.triggerCommand(command, args)
}

const mod: CoverageProviderModule = {
  async startCoverage() {
    if (enabled) {
      return
    }

    enabled = true

    await triggerCommand('__vitest_startV8Coverage')
  },

  async takeCoverage(): Promise<unknown> {
    return triggerCommand('__vitest_takeV8Coverage', [window.location.href])
  },

  stopCoverage() {
    // Browser mode should not stop coverage as same V8 instance is shared between tests
  },

  async getProvider(): Promise<V8CoverageProvider> {
    return loadProvider()
  },
}
export default mod
