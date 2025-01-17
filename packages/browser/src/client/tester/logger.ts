import { format, stringify } from 'vitest/utils'
import { getConfig } from '../utils'
import { rpc } from './rpc'

const { Date, console, performance } = globalThis

export function setupConsoleLogSpy() {
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
    sendLog('stdout', formatInput(item))
  }

  console.dirxml = (...args) => {
    dirxml(...args)
    sendLog('stdout', processLog(args))
  }

  console.trace = (...args: unknown[]) => {
    trace(...args)
    const content = processLog(args)
    const error = new Error('$$Trace')
    const processor = (globalThis as any).__vitest_worker__?.onFilterStackTrace || ((s: string) => s || '')
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
    }
    else {
      sendLog('stdout', `${label}: ${timeLabels[label]} ms`)
    }
  }

  console.timeEnd = (label = 'default') => {
    timeEnd(label)
    const end = performance.now()
    const start = timeLabels[label]
    if (!(label in timeLabels)) {
      sendLog('stderr', `Timer "${label}" does not exist`)
    }
    else if (typeof start !== 'undefined') {
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
}

function stdout(base: (...args: unknown[]) => void) {
  return (...args: unknown[]) => {
    base(...args)
    sendLog('stdout', processLog(args))
  }
}
function stderr(base: (...args: unknown[]) => void) {
  return (...args: unknown[]) => {
    base(...args)
    sendLog('stderr', processLog(args))
  }
}

function formatInput(input: unknown) {
  if (typeof input === 'object') {
    return stringify(input, undefined, {
      printBasicPrototype: false,
      escapeString: false,
    })
  }
  return format(input)
}

function processLog(args: unknown[]) {
  return args.map(formatInput).join(' ')
}

function sendLog(
  type: 'stdout' | 'stderr',
  content: string,
  disableStack?: boolean,
) {
  if (content.startsWith('[vite]')) {
    return
  }
  const unknownTestId = '__vitest__unknown_test__'
  // @ts-expect-error untyped global
  const taskId = globalThis.__vitest_worker__?.current?.id ?? unknownTestId
  const origin
    = getConfig().printConsoleTrace && !disableStack
      ? new Error('STACK_TRACE').stack?.split('\n').slice(1).join('\n')
      : undefined
  rpc().sendLog({
    origin,
    content,
    browser: true,
    time: Date.now(),
    taskId,
    type,
    size: content.length,
  })
}
