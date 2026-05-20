import type {
  ModuleGraphData,
  RunnerTestFile,
  SerializedRootConfig,
} from 'vitest'
import type { VitestClient, VitestClientRpc } from './ws'
import { decompressSync, strFromU8 } from 'fflate'
import { parse } from 'flatted'
import { reactive } from 'vue'
import { StateManager } from './state'

export interface HTMLReportMetadata {
  paths?: string[]
  files: RunnerTestFile[]
  config: SerializedRootConfig
  moduleGraph: Record<string, Record<string, ModuleGraphData>>
  unhandledErrors: unknown[]
  testModules: {
    projectName: string
    moduleId: string
    relativeModuleId: string
  }[]
  sourceCode: {
    codeTable: string[]
    testModules: { [projectName: string]: { [relativeModuleId: string]: number } }
  }
}

function deserializeReportMetadata(metadata: HTMLReportMetadata) {
  const sourceCodes: { [moduleId: string]: string } = {}
  for (const testModule of metadata.testModules) {
    const codeIndex = metadata.sourceCode.testModules[testModule.projectName]?.[testModule.relativeModuleId]
    if (codeIndex != null) {
      sourceCodes[testModule.moduleId] = metadata.sourceCode.codeTable[codeIndex]
    }
  }

  const rpc: VitestClientRpc = {
    getFiles: async () => {
      return metadata.files
    },
    getConfig: async () => {
      return metadata.config
    },
    getModuleGraph: async (projectName, id) => {
      return metadata.moduleGraph[projectName]?.[id]
    },
    getUnhandledErrors: async () => {
      return metadata.unhandledErrors
    },
    readTestFile: async (id) => {
      return sourceCodes[id]
    },
    getPaths: async () => metadata.paths ?? [],
    getResolvedProjectLabels: async () => [],
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
    ws: new EventTarget() as WebSocket,
    state: new StateManager(),
    rpc: undefined!,
    reconnect: () => registerMetadata(),
    waitForConnection: async () => {},
  })

  ctx.state.filesMap = reactive(ctx.state.filesMap)
  ctx.state.idMap = reactive(ctx.state.idMap)

  async function registerMetadata() {
    const metadataSource = window as Window & {
      HTML_REPORT_METADATA?: Promise<Uint8Array>
      METADATA_PATH?: string
    }
    const content = metadataSource.HTML_REPORT_METADATA
      ? await metadataSource.HTML_REPORT_METADATA
      : new Uint8Array(await (await fetch(metadataSource.METADATA_PATH!)).arrayBuffer())
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
    ctx.rpc = deserializeReportMetadata(metadata)
    ctx.ws.dispatchEvent(new Event('open'))
  }

  registerMetadata()

  return ctx
}
