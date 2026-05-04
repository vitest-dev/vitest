import type { ModuleMocker } from '@vitest/mocker/browser'
import type { CancelReason } from '@vitest/runner'
import type { BirpcReturn } from 'birpc'
import type { WebSocketBrowserEvents, WebSocketBrowserHandlers } from '../types'
import type { IframeOrchestrator } from './orchestrator'
import { createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'
import { getBrowserState } from './utils'

const PAGE_TYPE = getBrowserState().type

export const PORT: string = location.port
export const HOST: string = [location.hostname, PORT].filter(Boolean).join(':')
export const RPC_ID: string
  = PAGE_TYPE === 'orchestrator'
    ? getBrowserState().sessionId
    : getBrowserState().testerId
const METHOD = getBrowserState().method
export const ENTRY_URL: string = `${
  location.protocol === 'https:' ? 'wss:' : 'ws:'
}//${HOST}/__vitest_browser_api__?type=${PAGE_TYPE}&rpcId=${RPC_ID}&sessionId=${getBrowserState().sessionId}&projectName=${encodeURIComponent(getBrowserState().config.name || '')}&method=${METHOD}&token=${(window as any).VITEST_API_TOKEN || '0'}`

const onCancelCallbacks: ((reason: CancelReason) => void)[] = []

export function onCancel(callback: (reason: CancelReason) => void): void {
  onCancelCallbacks.push(callback)
}

export interface VitestBrowserClient {
  rpc: BrowserRPC
  ws: WebSocket
  waitForConnection: () => Promise<void>
}

export type BrowserRPC = BirpcReturn<
  WebSocketBrowserHandlers,
  WebSocketBrowserEvents
>

// ws connection can be established before the orchestrator is fully loaded
// in very rare cases in the preview provider
function waitForOrchestrator() {
  return new Promise<IframeOrchestrator>((resolve, reject) => {
    const type = getBrowserState().type
    if (type !== 'orchestrator') {
      reject(new TypeError('Only orchestrator can create testers.'))
      return
    }

    function check() {
      const orchestrator = getBrowserState().orchestrator
      if (orchestrator) {
        return resolve(orchestrator)
      }
      setTimeout(check)
    }
    check()
  })
}

function createClient() {
  const autoReconnect = true
  const reconnectInterval = 2000
  const reconnectTries = 10
  const connectTimeout = 60000

  let tries = reconnectTries

  const ctx: VitestBrowserClient = {
    ws: new WebSocket(ENTRY_URL),
    waitForConnection,
  } as VitestBrowserClient

  let onMessage: Function

  ctx.rpc = createBirpc<WebSocketBrowserHandlers, WebSocketBrowserEvents>(
    {
      async onCancel(reason) {
        await Promise.all(onCancelCallbacks.map(fn => fn(reason)))
      },
      async createTesters(options) {
        const orchestrator = await waitForOrchestrator()
        return orchestrator.createTesters(options)
      },
      async cleanupTesters() {
        const orchestrator = await waitForOrchestrator()
        return orchestrator.cleanupTesters()
      },
      cdpEvent(event: string, payload: unknown) {
        const cdp = getBrowserState().cdp
        if (!cdp) {
          return
        }
        cdp.emit(event, payload)
      },
      async resolveManualMock(url: string) {
        // @ts-expect-error not typed global API
        const mocker = globalThis.__vitest_mocker__ as ModuleMocker | undefined
        const responseId = getBrowserState().sessionId
        if (!mocker) {
          return { url, keys: [], responseId }
        }
        const exports = await mocker.resolveFactoryModule(url)
        const keys = Object.keys(exports)
        return {
          url,
          keys,
          responseId,
        }
      },
    },
    {
      post: msg => ctx.ws.send(msg),
      on: fn => (onMessage = fn),
      serialize: e =>
        stringify(e, (_, v) => {
          if (v instanceof Error) {
            return {
              name: v.name,
              message: v.message,
              stack: v.stack,
            }
          }
          return v
        }),
      deserialize: parse,
      timeout: -1, // createTesters can take a while
    },
  )

  // A single persistent promise that survives reconnects: callers awaiting
  // `waitForConnection()` follow the current attempt across drops, instead of
  // being stuck on a failed first socket.
  let resolveOpen!: () => void
  let rejectOpen!: (error: Error) => void
  let openSettled = false
  let openPromise: Promise<void> = createOpenPromise()
  let connectTimeoutId: ReturnType<typeof setTimeout> | undefined

  function createOpenPromise() {
    openSettled = false
    return new Promise<void>((resolve, reject) => {
      resolveOpen = () => {
        openSettled = true
        resolve()
      }
      rejectOpen = (error) => {
        openSettled = true
        reject(error)
      }
    })
  }

  function reconnect(reset = false) {
    if (reset) {
      tries = reconnectTries
    }
    if (openSettled) {
      openPromise = createOpenPromise()
    }
    ctx.ws = new WebSocket(ENTRY_URL)
    registerWS()
  }

  function registerWS() {
    if (connectTimeoutId !== undefined) {
      clearTimeout(connectTimeoutId)
    }
    connectTimeoutId = setTimeout(() => {
      rejectOpen(
        new Error(
          `Cannot connect to the server in ${connectTimeout / 1000} seconds`,
        ),
      )
    }, connectTimeout)
    if (ctx.ws.OPEN === ctx.ws.readyState) {
      tries = reconnectTries
      clearTimeout(connectTimeoutId)
      connectTimeoutId = undefined
      resolveOpen()
    }
    // still have a listener even if it's already open to update tries
    ctx.ws.addEventListener('open', () => {
      tries = reconnectTries
      if (connectTimeoutId !== undefined) {
        clearTimeout(connectTimeoutId)
        connectTimeoutId = undefined
      }
      resolveOpen()
    })
    ctx.ws.addEventListener('message', (v) => {
      onMessage(v.data)
    })
    ctx.ws.addEventListener('close', () => {
      tries -= 1
      if (autoReconnect && tries > 0) {
        if (connectTimeoutId !== undefined) {
          clearTimeout(connectTimeoutId)
          connectTimeoutId = undefined
        }
        setTimeout(reconnect, reconnectInterval)
      }
      else if (!openSettled) {
        if (connectTimeoutId !== undefined) {
          clearTimeout(connectTimeoutId)
          connectTimeoutId = undefined
        }
        rejectOpen(new Error('WebSocket connection closed before opening'))
      }
    })
  }

  registerWS()

  function waitForConnection() {
    return openPromise
  }

  return ctx
}

export const client: VitestBrowserClient = createClient()

export * from './channel'
