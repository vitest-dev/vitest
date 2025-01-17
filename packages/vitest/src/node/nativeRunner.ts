import { resolve } from 'node:path'
import { ViteNodeRunner } from 'vite-node/client'

export class NativeRunner extends ViteNodeRunner {
  override executeFile(file: string): Promise<any> {
    return import(resolve(this.options.root, file))
  }

  override executeId(rawId: string): Promise<any> {
    return import(resolve(this.options.root, rawId))
  }
}
