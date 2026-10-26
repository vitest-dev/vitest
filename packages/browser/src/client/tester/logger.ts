import type { TestExecutionMethod, UserConsoleLog } from 'vitest'
import { format } from 'vitest/internal/browser'
import { getConfig } from '../utils'
import { rpc } from './rpc'
import { getBrowserRunner } from './runner'

const { Date, console, performance, queueMicrotask } = globalThis

export function setupConsoleLogSpy(): void {
  const {
    log,
    info,
    error,
    dir,
    dirxml,
    trace,
    time,
    timeEnd,
    timeLog,
    warn,
    debug,
    count,
    countReset,
  } = console
  console.log = stdout(log)
  console.debug = stdout(debug)
  console.info = stdout(info)

  console.error = stderr(error)
  console.warn = stderr(warn)

  console.dir = (item, options) => {
    dir(item, options)
    enqueueLog('stdout', processLog([item]))
  }

  console.dirxml = (...args) => {
    dirxml(...args)
    enqueueLog('stdout', processLog(args))
  }

  console.trace = (...args: unknown[]) => {
    trace(...args)
    const content = processLog(args)
    const error = new Error('$$Trace')
    const processor =
      (globalThis as any).__vitest_worker__?.onFilterStackTrace || ((s: string) => s || '')
    const stack = processor(error.stack || '')
    enqueueLog('stderr', `${content}\n${stack}`, true)
  }

  const timeLabels: Record<string, number> = {}

  console.time = (label = 'default') => {
    time(label)
    const now = performance.now()
    timeLabels[label] = now
  }

  console.timeLog = (label = 'default') => {
    timeLog(label)
    if (!(label in timeLabels)) {
      enqueueLog('stderr', `Timer "${label}" does not exist`)
    } else {
      enqueueLog('stdout', `${label}: ${timeLabels[label]} ms`)
    }
  }

  console.timeEnd = (label = 'default') => {
    timeEnd(label)
    const end = performance.now()
    const start = timeLabels[label]
    if (!(label in timeLabels)) {
      enqueueLog('stderr', `Timer "${label}" does not exist`)
    } else if (typeof start !== 'undefined') {
      const duration = end - start
      enqueueLog('stdout', `${label}: ${duration} ms`)
    }
  }

  const countLabels: Record<string, number> = {}

  console.count = (label = 'default') => {
    count(label)
    const counter = (countLabels[label] ?? 0) + 1
    countLabels[label] = counter
    enqueueLog('stdout', `${label}: ${counter}`)
  }

  console.countReset = (label = 'default') => {
    countReset(label)
    countLabels[label] = 0
  }
}

function stdout(base: (...args: unknown[]) => void) {
  return (...args: unknown[]) => {
    base(...args)
    // ignore shadow root logs from wdio
    // https://github.com/webdriverio/webdriverio/discussions/14221
    if (args[0] === '[WDIO]') {
      if (args[1] === 'newShadowRoot' || args[1] === 'removeShadowRoot') {
        return
      }
    }
    enqueueLog('stdout', processLog(args))
  }
}
function stderr(base: (...args: unknown[]) => void) {
  return (...args: unknown[]) => {
    base(...args)
    enqueueLog('stderr', processLog(args))
  }
}

function processLog(args: unknown[]) {
  return format(args, { multiline: true })
}

// A console call per RPC request saturates the server's main thread: it parses
// each message, writes it to stdout, then stringifies and sends a response.
// Commands from other browsers queue behind that backlog and time out, so buffer
// the logs and flush them once per macrotask, like the Node worker console does.
const pendingLogs: { method: TestExecutionMethod; log: UserConsoleLog }[] = []
let flushScheduled = false

function enqueueLog(type: 'stdout' | 'stderr', content: string, disableStack?: boolean) {
  if (content.startsWith('[vite]')) {
    return
  }
  const unknownTestId = '__vitest__unknown_test__'
  // @ts-expect-error untyped global
  const taskId = globalThis.__vitest_worker__?.current?.id ?? unknownTestId
  const origin =
    getConfig().printConsoleTrace && !disableStack
      ? new Error('STACK_TRACE').stack?.split('\n').slice(1).join('\n')
      : undefined
  const runner = getBrowserRunner()
  pendingLogs.push({
    method: runner?.method || 'run',
    log: {
      origin,
      content,
      browser: true,
      time: Date.now(),
      taskId,
      type,
      size: content.length,
    },
  })
  // a tight loop can emit hundreds of thousands of logs without ever yielding,
  // so cap the batch rather than building one unbounded RPC message
  if (pendingLogs.length >= 500) {
    flushLogs()
  } else if (!flushScheduled) {
    flushScheduled = true
    queueMicrotask(flushLogs)
  }
}

function flushLogs() {
  flushScheduled = false
  if (!pendingLogs.length) {
    return
  }
  const batch = pendingLogs.splice(0)
  // 'run' and 'collect' are separate sessions on the server, so keep them apart
  const byMethod = new Map<TestExecutionMethod, UserConsoleLog[]>()
  for (const { method, log } of batch) {
    const logs = byMethod.get(method)
    if (logs) {
      logs.push(log)
    } else {
      byMethod.set(method, [log])
    }
  }
  for (const [method, logs] of byMethod) {
    rpc().sendLog(method, logs)
  }
}
