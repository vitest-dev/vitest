import type { InspectorNotification } from 'node:inspector'
import { version as viteVersion } from 'vite'
import { expect, test } from 'vitest'
import WebSocket from 'ws'

import { runVitestCli } from '../../test-utils'

type Message = Partial<InspectorNotification<any>>

// TODO: make sure source maps have the first line
// github.com/vitest-dev/vitest/pull/5355/files#diff-2e5976c3b475dbec1b95a09f2802be49b72c999e68465b0d1ae61452f0334798R53
test.skip('--inspect-brk stops at test file', async () => {
  const { vitest, waitForClose } = await runVitestCli(
    '--root',
    'fixtures/inspect',
    '--inspect-brk',
    '9232',
    '--no-file-parallelism',
  )

  await vitest.waitForStderr('Debugger listening on ')
  const url = vitest.stderr.split('\n')[0].replace('Debugger listening on ', '')

  const { receive, send } = await createChannel(url)

  send({ method: 'Debugger.enable' })
  send({ method: 'Runtime.enable' })
  await receive('Runtime.executionContextCreated')

  const paused = receive('Debugger.paused')
  send({ method: 'Runtime.runIfWaitingForDebugger' })

  // TODO: this is never resolved
  const { params } = await paused
  const scriptId = params.callFrames[0].functionLocation.scriptId

  // Verify that debugger paused on test file
  const response = receive()
  send({ method: 'Debugger.getScriptSource', params: { scriptId } })
  const { result } = await response as any

  if (viteVersion[0] >= '6') {
    // vite ssr transform wraps import by
    //   (0, __vite_ssr_import_0__.test)(...)
    expect(result.scriptSource).toContain('test)("sum", () => {')
    expect(result.scriptSource).toContain('expect)(1 + 1).toBe(2)')
  }
  else {
    expect(result.scriptSource).toContain('test("sum", () => {')
    expect(result.scriptSource).toContain('expect(1 + 1).toBe(2)')
  }

  send({ method: 'Debugger.resume' })

  await vitest.waitForStdout('Test Files  1 passed (1)')
  await waitForClose()
}, 5_000)

async function createChannel(url: string) {
  const ws = new WebSocket(url, { allowSynchronousEvents: false })

  let id = 1
  let receiver = defer()

  ws.onerror = receiver.reject
  ws.onmessage = (message) => {
    const response = JSON.parse(message.data.toString())
    receiver.resolve(response)
  }

  async function receive(filter?: string) {
    const message = await receiver.promise
    receiver = defer()

    if (filter && message.method !== filter) {
      return receive(filter)
    }

    return message
  }

  function send(message: Message) {
    ws.send(JSON.stringify({ ...message, id: id++ }))
  }

  await new Promise(r => ws.on('open', r))

  return { receive, send }
}

function defer(): {
  promise: Promise<Message>
  resolve: (response: Message) => void
  reject: (error: unknown) => void
} {
  const pr = {} as ReturnType<typeof defer>

  pr.promise = new Promise((resolve, reject) => {
    pr.resolve = resolve
    pr.reject = reject
  })

  return pr
}
