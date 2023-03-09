import type { TransformResult } from 'vite'
import { ViteNodeServer } from 'vite-node/server'
import { hoistModuleMocks } from './mock'

export class VitestServer extends ViteNodeServer {
  protected async processTransformResult(result: TransformResult): Promise<TransformResult> {
    const { id: vitestId } = (await this.resolveId('vitest')) || { id: 'vitest' }
    return super.processTransformResult(hoistModuleMocks(result, vitestId))
  }
}
