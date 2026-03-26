import type { ScriptCoverageWithOffset } from './provider'
import { WebSocket } from 'ws'
import provider from './index'

// eslint-disable-next-line antfu/no-top-level-await -- This should be blocking module loading
await initialize().catch((error) => {
  console.error('[vitest-coverage] Error initializing process/thread intercepting:', error)
  throw error
})

async function initialize() {
  let reportedCoverage = false

  const ws = new WebSocket(`ws://localhost:${Number(process.env.VITEST_WS_PORT)}`)

  // @ts-expect-error -- untyped
  ws.on('open', () => ws._socket?.unref?.())

  await provider.startCoverage?.({
    isolate: true,

    // Environment options that were set by parent should inherit, no need to add more ws servers
    trackProcessAndWorker: false,
  })

  onMessage(message => message === 'take-coverage' && takeCoverage())
  process.on('beforeExit', takeCoverage)

  async function takeCoverage() {
    if (reportedCoverage) {
      return
    }

    reportedCoverage = true

    const coverage = await provider.takeCoverage?.({
    // Start offset should be 0 as these run outside of Vite
      moduleExecutionInfo: undefined,
    }) as { result: ScriptCoverageWithOffset[] }

    ws.send(JSON.stringify(coverage.result.map(entry => ({ ...entry, isExtendedContext: true }))))

    await provider.stopCoverage?.({ isolate: true })

    ws.close()
  }

  async function onMessage(callback: (message: unknown) => void) {
    ws.on('message', raw => callback(raw.toString()))
  }
}
