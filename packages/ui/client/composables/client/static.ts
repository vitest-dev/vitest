import type { BirpcReturn } from 'birpc'
import type { VitestClient } from '@vitest/ws-client'
import type { WebSocketHandlers } from 'vitest/src/api/types'
import { StateManager } from '../../../../vitest/src/node/state'

interface VitestMetadata {
  files: any
}

const noop: any = () => {}
const asyncNoop: any = () => Promise.resolve()

export function createStaticClient(): VitestClient {
  const ctx = reactive({
    state: new StateManager(),
    waitForConnection,
    reconnect,
    ws: new EventTarget(),
  }) as VitestClient

  ctx.state.filesMap = reactive(ctx.state.filesMap)
  ctx.state.idMap = reactive(ctx.state.idMap)

  let metadata!: VitestMetadata

  const rpc = {
    getFiles: () => {
      return metadata.files
    },
    getPaths: async () => {
      return metadata.files
    },
    getConfig: () => {
      return metadata.files
    },
    getModuleGraph: async () => {
      return metadata.files
    },
    getTransformResult: async () => {
      return metadata.files
    },
    readFile: async () => {
      return metadata.files
    },
    onWatcherStart: asyncNoop,
    onFinished: asyncNoop,
    onCollected: asyncNoop,
    onTaskUpdate: noop,
    writeFile: asyncNoop,
    rerun: asyncNoop,
    updateSnapshot: asyncNoop,
  } as WebSocketHandlers

  ctx.rpc = rpc as any as BirpcReturn<WebSocketHandlers>

  let openPromise: Promise<void>

  function reconnect() {
    registerMetadata()
  }

  async function registerMetadata() {
    const res = await fetch(window.METADATA_PATH!)
    metadata = await res.json() as VitestMetadata
    const event = new Event('open')
    ctx.ws.dispatchEvent(event)
  }

  registerMetadata()

  function waitForConnection() {
    return openPromise
  }

  return ctx
}
