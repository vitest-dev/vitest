import type { TestExecutionMethod, UserConsoleLog } from 'vitest'
import { format } from 'vitest/internal/browser'
import { getConfig } from '../utils'
import { rpc } from './rpc'
import { getBrowserRunner } from './runner'

const { Date, console, performance, queueMicrotask, setTimeout } = globalThis

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
    sendLog('stdout', processLog([item]))
  }

  console.dirxml = (...args) => {
    dirxml(...args)
    sendLog('stdout', processLog(args))
  }

  console.trace = (...args: unknown[]) => {
    trace(...args)
    const content = processLog(args)
    const error = new Error('$$Trace')
    const processor =
      (globalThis as any).__vitest_worker__?.onFilterStackTrace || ((s: string) => s || '')
    const stack = processor(error.stack || '')
    sendLog('stderr', `${content}\n${stack}`, true)
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
      sendLog('stderr', `Timer "${label}" does not exist`)
    } else {
      sendLog('stdout', `${label}: ${timeLabels[label]} ms`)
    }
  }

  console.timeEnd = (label = 'default') => {
    timeEnd(label)
    const end = performance.now()
    const start = timeLabels[label]
    if (!(label in timeLabels)) {
      sendLog('stderr', `Timer "${label}" does not exist`)
    } else if (typeof start !== 'undefined') {
      const duration = end - start
      sendLog('stdout', `${label}: ${duration} ms`)
    }
  }

  const countLabels: Record<string, number> = {}

  console.count = (label = 'default') => {
    count(label)
    const counter = (countLabels[label] ?? 0) + 1
    countLabels[label] = counter
    sendLog('stdout', `${label}: ${counter}`)
  }

  console.countReset = (label = 'default') => {
    countReset(label)
    countLabels[label] = 0
  }

  window.addEventListener('pagehide', onPageHide)
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
    sendLog('stdout', processLog(args))
  }
}
function stderr(base: (...args: unknown[]) => void) {
  return (...args: unknown[]) => {
    base(...args)
    sendLog('stderr', processLog(args))
  }
}

function processLog(args: unknown[]) {
  return format(args, { multiline: true })
}

const MAX_QUEUED_LOGS = 1000
const MAX_QUEUED_SIZE = 1_000_000

let queuedLogs: UserConsoleLog[] = []
let queuedSize = 0
let queuedMethod: TestExecutionMethod = 'run'
// logs are joined until the next microtask, like in Node workers
let joinable = false
let pageHidden = false

// timers don't fire once the iframe is removed, so send logs right away from then on
function onPageHide(event: PageTransitionEvent) {
  // tests can dispatch their own "pagehide"
  if (event.isTrusted) {
    pageHidden = true
    flushLogs()
  }
}

function sendLog(type: 'stdout' | 'stderr', content: string, disableStack?: boolean) {
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
  const method = getBrowserRunner()?.method || 'run'
  if (method !== queuedMethod) {
    flushLogs()
    queuedMethod = method
  }
  const last = queuedLogs.at(-1)
  if (!last) {
    setTimeout(flushLogs)
  }
  if (joinable && last && !last.origin && !origin && last.type === type && last.taskId === taskId) {
    last.content += `\n${content}`
    last.size = last.content.length
  } else {
    queuedLogs.push({
      origin,
      content,
      browser: true,
      time: Date.now(),
      taskId,
      type,
      size: content.length,
    })
  }
  if (!joinable) {
    joinable = true
    queueMicrotask(() => {
      joinable = false
    })
  }
  queuedSize += content.length + 1
  if (pageHidden || queuedLogs.length >= MAX_QUEUED_LOGS || queuedSize >= MAX_QUEUED_SIZE) {
    flushLogs()
  }
}

export function flushLogs(): void {
  if (!queuedLogs.length) {
    return
  }
  const logs = queuedLogs
  queuedLogs = []
  queuedSize = 0
  rpc().sendLog(queuedMethod, logs)
}
