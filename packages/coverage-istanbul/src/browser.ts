import type { CoverageProviderModule } from 'vitest/node'
import { BaseCoverageProviderModule } from './base'

function triggerCommand(command: string, args: any[] = []): Promise<any> {
  return (globalThis as any).__vitest_browser_runner__?.commands?.triggerCommand?.(command, args)
}

const mod: CoverageProviderModule = {
  takeCoverage() {
    const coverage = BaseCoverageProviderModule.takeCoverage()

    if (!coverage) {
      return
    }

    return triggerCommand('__vitest_writeCoverageFile', [coverage])
  },

  startCoverage() {
    BaseCoverageProviderModule.startCoverage()
  },

  getProvider() {
    return BaseCoverageProviderModule.getProvider()
  },
}

export default mod
