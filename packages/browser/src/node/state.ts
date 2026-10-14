import type { BrowserServerState as IBrowserServerState, TestProject } from 'vitest/node'
import type { WebSocketBrowserRPC } from '../types'

export class BrowserServerState implements IBrowserServerState {
  public readonly orchestrators: Map<string, WebSocketBrowserRPC> = new Map()
  public readonly testers: Map<string, WebSocketBrowserRPC> = new Map()
  // reported by the orchestrator: whether the browser accepts an import map after a module loaded
  public lateImportMaps: boolean | undefined

  // a rule stays in the document until the run ends, and a non-isolated
  // run shares one document between its files
  public usesImportMaps(config: TestProject['config']): boolean {
    const option = config.browser.importMapMocks
    if (option === true) {
      return true
    }
    return option !== false && this.lateImportMaps === true && config.isolate
  }
}
