import type {
  ModuleGraphData,
  RunnerTestFile,
  SerializedRootConfig,
  WebSocketHandlers,
} from 'vitest'
import type { VitestClient } from './ws'
import { decompressSync, strFromU8 } from 'fflate'
import { parse } from 'flatted'
import { reactive } from 'vue'
import { StateManager } from './state'

export interface HTMLReportMetadata {
  files: RunnerTestFile[]
  config: SerializedRootConfig
  moduleGraph: Record<string, Record<string, ModuleGraphData>>
  unhandledErrors: unknown[]
  // filename -> source
  sources: Record<string, string>
}

function deserializeReportMetadata(metadata: HTMLReportMetadata) {
  const rpc: WebSocketHandlers = {
    getFiles: () => {
      return metadata.files
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
    readTestFile: async (id) => {
      return metadata.sources[id]
    },
    getPaths: () => [],
    getResolvedProjectLabels: () => [],
    getExternalResult: async () => undefined,
    getTransformResult: async () => undefined,
    rerun: async () => {},
    rerunTask: async () => {},
    updateSnapshot: async () => {},
    saveTestFile: async () => {},
    getTestFiles: async () => [],
  }
  return rpc
}

export function createStaticClient(): VitestClient {
  const ctx = reactive<VitestClient>({
    state: new StateManager(),
    reconnect: async () => registerMetadata(),
    rpc: {} as any,
    ws: new EventTarget() as any,
  })

  ctx.state.filesMap = reactive(ctx.state.filesMap)
  ctx.state.idMap = reactive(ctx.state.idMap)

  async function registerMetadata() {
    const res = await fetch(window.METADATA_PATH!)
    const content = new Uint8Array(await res.arrayBuffer())
    let metadata: HTMLReportMetadata
    // Check for gzip magic numbers (0x1f 0x8b) to determine if content is compressed.
    // This handles cases where a static server incorrectly sets Content-Encoding: gzip
    // for .gz files, causing the browser to auto-decompress before we process the raw gzip data.
    if (content.length >= 2 && content[0] === 0x1F && content[1] === 0x8B) {
      const decompressed = strFromU8(decompressSync(content))
      metadata = parse(decompressed)
    }
    else {
      metadata = parse(strFromU8(content))
    }
    ctx.rpc = deserializeReportMetadata(metadata) as any
    ctx.ws.dispatchEvent(new Event('open'))
  }

  registerMetadata()

  return ctx
}
