import type { VitestRunner } from '@vitest/runner'
import type { ResolvedConfig } from '#types'

// TODO should be inside browser package
export class BrowserTestRunner implements VitestRunner {
  hasMap = new Map<string, string>()

  constructor(public config: ResolvedConfig) {
    this.config = config
  }

  async importFile(filepath: string) {
    const match = filepath.match(/^(\w:\/)/)
    const hash = this.hasMap.get(filepath)
    if (match)
      return await import(`/@fs/${filepath.slice(match[1].length)}?v=${hash}`)
    else
      return await import(`${filepath}?v=${hash}`)
  }
}
