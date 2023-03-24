import type { TransformResult } from 'vite'
import { ViteNodeServer } from 'vite-node/server'
import { hoistModuleMocks } from './mock'

export class VitestServer extends ViteNodeServer {
  private _vitestPath?: string

  private async getVitestPath() {
    if (!this._vitestPath) {
      const { id } = await this.resolveId('vitest') || { id: 'vitest' }
      this._vitestPath = id
    }
    return this._vitestPath
  }

  protected async processTransformResult(result: TransformResult): Promise<TransformResult> {
    const vitestId = await this.getVitestPath()
    return super.processTransformResult(hoistModuleMocks(result, vitestId))
  }
}
