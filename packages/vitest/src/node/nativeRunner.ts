import { resolve } from 'node:path'
import { ViteNodeRunner } from 'vite-node/client'

export class NativeRunner extends ViteNodeRunner {
  override executeFile(file: string): Promise<any> {
    if (file[0] === '.') {
      return import(resolve(this.options.root, file))
    }
    return import(file)
  }

  override executeId(rawId: string): Promise<any> {
    if (rawId[0] === '.') {
      return import(resolve(this.options.root, rawId))
    }
    return import(rawId)
  }
}
