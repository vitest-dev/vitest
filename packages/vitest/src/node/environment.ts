import { DevEnvironment } from 'vite'
import { ViteNodeProcessor } from 'vite-node/server'

export class VitestDevEnvironemnt extends DevEnvironment {
  public readonly processor = new ViteNodeProcessor(
    this,
    this.config.test?.server,
  )
}
