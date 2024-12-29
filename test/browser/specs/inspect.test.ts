import type { InspectorNotification } from 'node:inspector'
import { expect, test, vi } from 'vitest'
import WebSocket from 'ws'

import { runVitestCli } from '../../test-utils'

type Message = Partial<InspectorNotification<any>>

const IS_PLAYWRIGHT = process.env.PROVIDER === 'playwright'
const REMOTE_DEBUG_URL = '127.0.0.1:9123'

test.runIf(IS_PLAYWRIGHT || !process.env.CI)('--inspect-brk stops at test file', async () => {
  const { vitest, waitForClose } = await runVitestCli(
    '--root',
    'fixtures/inspect',
    '--browser',
    '--no-file-parallelism',
    '--inspect-brk',
    REMOTE_DEBUG_URL,
  )

  await vitest.waitForStdout(`Debugger listening on ws://${REMOTE_DEBUG_URL}`)

  const url = await vi.waitFor(() =>
    fetch(`http://${REMOTE_DEBUG_URL}/json/list`)
      .then(response => response.json())
      .then(json => json[0].webSocketDebuggerUrl))

  const { receive, send } = await createChannel(url)

  const paused = receive('Debugger.paused')
  send({ method: 'Debugger.enable' })
  send({ method: 'Runtime.enable' })

  await receive('Runtime.executionContextCreated')
  send({ method: 'Runtime.runIfWaitingForDebugger' })

  const { params } = await paused
  const scriptId = params.callFrames[0].functionLocation.scriptId

  // Verify that debugger paused on test file
  const { result } = await send({ method: 'Debugger.getScriptSource', params: { scriptId } })

  expect(result.scriptSource).toContain('test("sum", () => {')
  expect(result.scriptSource).toContain('expect(1 + 1).toBe(2)')

  send({ method: 'Debugger.resume' })

  await vitest.waitForStdout('Test Files  1 passed (1)')
  await waitForClose()
})

async function createChannel(url: string) {
  const ws = new WebSocket(url)

  let id = 1
  let listeners = []

  ws.onmessage = (message) => {
    const response = JSON.parse(message.data.toString())
    listeners.forEach(listener => listener(response))
  }

  async function receive(methodOrId?: string | { id: number }): Promise<Message> {
    const { promise, resolve, reject } = withResolvers()
    listeners.push(listener)
    ws.onerror = reject

    function listener(message) {
      const filter = typeof methodOrId === 'string' ? { method: methodOrId } : { id: methodOrId.id }

      const methodMatch = message.method && message.method === filter.method
      const idMatch = message.id && message.id === filter.id

      if (methodMatch || idMatch) {
        resolve(message)
        listeners = listeners.filter(l => l !== listener)
        ws.onerror = undefined
      }
      else if (!filter.id && !filter.method) {
        resolve(message)
      }
    }

    return promise
  }

  async function send(message: Message): Promise<any> {
    const currentId = id++
    const json = JSON.stringify({ ...message, id: currentId })

    const receiver = receive({ id: currentId })
    ws.send(json)

    return receiver
  }

  await new Promise((resolve, reject) => {
    ws.onerror = reject
    ws.on('open', resolve)
  })

  return { receive, send }
}

function withResolvers() {
  let reject: (error: unknown) => void
  let resolve: (response: Message) => void

  const promise: Promise<Message> = new Promise((...args) => {
    [resolve, reject] = args
  })

  return { promise, resolve, reject }
}
