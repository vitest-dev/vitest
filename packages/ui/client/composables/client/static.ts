import type { BirpcReturn } from 'birpc'
import type { VitestClient } from '@vitest/ws-client'
import type { WebSocketHandlers } from 'vitest/src/api/types'
import { parse } from 'flatted'
import { decompressSync, strFromU8 } from 'fflate'
import type { File, ModuleGraphData, ResolvedConfig } from 'vitest/src/types'
import { StateManager } from '../../../../vitest/src/node/state'

interface HTMLReportMetadata {
  paths: string[]
  files: File[]
  config: ResolvedConfig
  moduleGraph: Record<string, ModuleGraphData>
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

  let metadata!: HTMLReportMetadata

  const rpc = {
    getFiles: () => {
      return metadata.files
    },
    getPaths: () => {
      return metadata.paths
    },
    getConfig: () => {
      return metadata.config
    },
    getModuleGraph: async (id) => {
      return metadata.moduleGraph[id]
    },
    getTransformResult: async (id) => {
      return {
        code: id,
        source: '',
        map: null,
      }
    },
    onDone: noop,
    onCollected: asyncNoop,
    onTaskUpdate: noop,
    writeFile: asyncNoop,
    rerun: asyncNoop,
    updateSnapshot: asyncNoop,
    resolveSnapshotPath: asyncNoop,
    snapshotSaved: asyncNoop,
    onAfterSuiteRun: asyncNoop,
    onCancel: asyncNoop,
    getCountOfFailedTests: () => 0,
    sendLog: asyncNoop,
    resolveSnapshotRawPath: asyncNoop,
    readSnapshotFile: asyncNoop,
    saveSnapshotFile: asyncNoop,
    readTestFile: asyncNoop,
    removeSnapshotFile: asyncNoop,
  } as WebSocketHandlers

  ctx.rpc = rpc as any as BirpcReturn<WebSocketHandlers>

  let openPromise: Promise<void>

  function reconnect() {
    registerMetadata()
  }

  async function registerMetadata() {
    const res = await fetch(window.METADATA_PATH!)
    const contentType = res.headers.get('content-type')?.toLowerCase() || ''
    if (contentType.includes('application/gzip') || contentType.includes('application/x-gzip')) {
      const compressed = new Uint8Array(await res.arrayBuffer())
      const decompressed = strFromU8(decompressSync(compressed))
      metadata = parse(decompressed) as HTMLReportMetadata
    }
    else {
      metadata = parse(await res.text()) as HTMLReportMetadata
    }
    const event = new Event('open')
    ctx.ws.dispatchEvent(event)
  }

  registerMetadata()

  function waitForConnection() {
    return openPromise
  }

  return ctx
}
