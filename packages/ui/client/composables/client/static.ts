import type { VitestClient } from '@vitest/ws-client'
import type { BirpcReturn } from 'birpc'
import type {
  File,
  ModuleGraphData,
  SerializedConfig,
  WebSocketEvents,
  WebSocketHandlers,
} from 'vitest'
import { decompressSync, strFromU8 } from 'fflate'
import { parse } from 'flatted'
import { StateManager } from '../../../../ws-client/src/state'

interface HTMLReportMetadata {
  paths: string[]
  files: File[]
  config: SerializedConfig
  moduleGraph: Record<string, Record<string, ModuleGraphData>>
  unhandledErrors: unknown[]
  // filename -> source
  sources: Record<string, string>
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
    getModuleGraph: async (projectName, id) => {
      return metadata.moduleGraph[projectName]?.[id]
    },
    getUnhandledErrors: () => {
      return metadata.unhandledErrors
    },
    getTransformResult: asyncNoop,
    onDone: noop,
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
    readTestFile: async (id: string) => {
      return metadata.sources[id]
    },
    removeSnapshotFile: asyncNoop,
    onUnhandledError: noop,
    saveTestFile: asyncNoop,
    getProvidedContext: () => ({}),
    getTestFiles: asyncNoop,
  } as WebSocketHandlers

  ctx.rpc = rpc as any as BirpcReturn<WebSocketHandlers, WebSocketEvents>

  let openPromise: Promise<void>

  function reconnect() {
    registerMetadata()
  }

  async function registerMetadata() {
    const res = await fetch(window.METADATA_PATH!)
    const contentType = res.headers.get('content-type')?.toLowerCase() || ''
    // workaround sirv (vite preview) responding decoded data for direct .gz request
    // https://github.com/lukeed/sirv/issues/158
    // https://github.com/vitejs/vite/issues/12266
    if (res.headers.get('content-type') === 'application/json') {
      metadata = parse(await res.text()) as HTMLReportMetadata
    } else {
      const compressed = new Uint8Array(await res.arrayBuffer())
      const decompressed = strFromU8(decompressSync(compressed))
      metadata = parse(decompressed) as HTMLReportMetadata
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
