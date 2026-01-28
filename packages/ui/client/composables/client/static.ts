import type { VitestClient } from '@vitest/ws-client'
import type { BirpcReturn } from 'birpc'
import type {
  ModuleGraphData,
  RunnerTestFile,
  SerializedConfig,
  WebSocketEvents,
  WebSocketHandlers,
} from 'vitest'
import { decompressSync, strFromU8 } from 'fflate'
import { parse } from 'flatted'
import { reactive } from 'vue'
import { StateManager } from '../../../../ws-client/src/state'

interface HTMLReportMetadata {
  paths: string[]
  files: RunnerTestFile[]
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
    getResolvedProjectLabels: () => {
      return []
    },
    getModuleGraph: async (projectName, id) => {
      return metadata.moduleGraph[projectName]?.[id]
    },
    getUnhandledErrors: () => {
      return metadata.unhandledErrors
    },
    getExternalResult: asyncNoop,
    getTransformResult: asyncNoop,
    onDone: noop,
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
    const content = new Uint8Array(await res.arrayBuffer())

    // Check for gzip magic numbers (0x1f 0x8b) to determine if content is compressed.
    // This handles cases where a static server incorrectly sets Content-Encoding: gzip
    // for .gz files, causing the browser to auto-decompress before we process the raw gzip data.
    if (content.length >= 2 && content[0] === 0x1F && content[1] === 0x8B) {
      const decompressed = strFromU8(decompressSync(content))
      metadata = parse(decompressed) as HTMLReportMetadata
    }
    else {
      metadata = parse(strFromU8(content)) as HTMLReportMetadata
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
