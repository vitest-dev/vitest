import type { Profiler } from 'node:inspector'
import type { CoverageProviderModule } from 'vitest/node'
import type { ScriptCoverageWithOffset, V8CoverageProvider } from './provider'
import inspector from 'node:inspector/promises'
import { fileURLToPath } from 'node:url'
import { getPort } from 'get-port-please'
import { normalize } from 'pathe'
import { provider } from 'std-env'
import { WebSocketServer } from 'ws'
import { loadProvider } from './load-provider'

let session: inspector.Session | null = null
let enabled = false

const mod: CoverageProviderModule & { wss: WebSocketServer | undefined; extendedContextCoverage: Profiler.ScriptCoverage[] } = {
  wss: undefined,
  extendedContextCoverage: [],

  async startCoverage({ isolate, trackProcessAndWorker }) {
    if (isolate === false && enabled) {
      return
    }

    enabled = true

    if (trackProcessAndWorker) {
      const port = await getPort()
      this.wss = new WebSocketServer({ port })

      this.wss.on('connection', socket => socket.on('message', (raw) => {
        const result: ScriptCoverageWithOffset[] = JSON.parse(raw.toString())
        this.extendedContextCoverage.push(...(result || []))
      }))

      process.env.NODE_OPTIONS ||= ''
      process.env.NODE_OPTIONS += ' --import @vitest/coverage-v8/intercept-new-run-context'
      process.env.VITEST_WS_PORT = `${port}`
    }

    session ||= new inspector.Session()
    session.connect()
    await session.post('Profiler.enable')
    await session.post('Profiler.startPreciseCoverage', { callCount: true, detailed: true })
  },

  async takeCoverage(options): Promise<{ result: ScriptCoverageWithOffset[] }> {
    if (provider === 'stackblitz') {
      return { result: [] }
    }

    if (!session) {
      throw new Error('V8 provider missing inspector session.')
    }

    this.wss?.clients.forEach(client => client.send('take-coverage'))
    const coverage = await session.post('Profiler.takePreciseCoverage')
    const result: ScriptCoverageWithOffset[] = []

    // Reduce amount of data sent over rpc by doing some early result filtering
    for (const entry of [...coverage.result, ...this.extendedContextCoverage.splice(0)]) {
      if (filterResult(entry)) {
        result.push({
          ...entry,
          startOffset: options?.moduleExecutionInfo?.get(normalize(fileURLToPath(entry.url)))?.startOffset || 0,
        })
      }
    }

    return { result }
  },

  async stopCoverage({ isolate }) {
    if (isolate === false) {
      return
    }

    if (!session) {
      throw new Error('V8 provider missing inspector session.')
    }

    await session.post('Profiler.stopPreciseCoverage')
    await session.post('Profiler.disable')
    session.disconnect()
    this.wss?.close()
  },

  async getProvider(): Promise<V8CoverageProvider> {
    return loadProvider()
  },
}
export default mod

function filterResult(coverage: Profiler.ScriptCoverage): boolean {
  if (!coverage.url.startsWith('file://')) {
    return false
  }

  if (coverage.url.includes('/node_modules/')) {
    return false
  }

  if (coverage.url.includes('/@id/@vitest/')) {
    return false
  }

  if (coverage.url.includes('/@vite/client')) {
    return false
  }

  return true
}
