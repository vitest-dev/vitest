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
  projects: string[]
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
    getResolvedProjectNames: () => {
      return metadata.projects
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
    rerunTask: asyncNoop,
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

  const openPromise = Promise.resolve()

  function reconnect() {
    registerMetadata()
  }

  async function registerMetadata() {
    const res = await fetch(window.METADATA_PATH!)
    const contentType = res.headers.get('content-type')?.toLowerCase() || ''
    if (
      contentType.includes('application/gzip')
      || contentType.includes('application/x-gzip')
    ) {
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
