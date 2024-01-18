import { rpc } from './rpc'
import { importId } from './utils'

const { Date, console } = globalThis

export async function setupConsoleLogSpy(basePath: string) {
  const { stringify, format, inspect } = await importId('vitest/utils', basePath) as typeof import('vitest/utils')
  const { log, info, error, dir, dirxml, trace, time, timeEnd, timeLog, warn, debug, count, countReset } = console
  const formatInput = (input: unknown) => {
    if (input instanceof Node)
      return stringify(input)
    return format(input)
  }
  const processLog = (args: unknown[]) => args.map(formatInput).join(' ')
  const sendLog = (type: 'stdout' | 'stderr', content: string) => {
    if (content.startsWith('[vite]'))
      return
    const unknownTestId = '__vitest__unknown_test__'
    // @ts-expect-error untyped global
    const taskId = globalThis.__vitest_worker__?.current?.id ?? unknownTestId
    rpc().sendLog({
      content,
      time: Date.now(),
      taskId,
      type,
      size: content.length,
    })
  }
  const stdout = (base: (...args: unknown[]) => void) => (...args: unknown[]) => {
    sendLog('stdout', processLog(args))
    return base(...args)
  }
  const stderr = (base: (...args: unknown[]) => void) => (...args: unknown[]) => {
    sendLog('stderr', processLog(args))
    return base(...args)
  }
  console.log = stdout(log)
  console.debug = stdout(debug)
  console.info = stdout(info)

  console.error = stderr(error)
  console.warn = stderr(warn)

  console.dir = (item, options) => {
    sendLog('stdout', inspect(item, options))
    return dir(item, options)
  }

  console.dirxml = (...args) => {
    sendLog('stdout', processLog(args))
    return dirxml(...args)
  }

  console.trace = (...args: unknown[]) => {
    const content = processLog(args)
    const error = new Error('Trace')
    const stack = (error.stack || '').split('\n').slice(2).join('\n')
    sendLog('stdout', `${content}\n${stack}`)
    return trace(...args)
  }

  const timeLabels: Record<string, number> = {}

  console.time = (label = 'default') => {
    const now = performance.now()
    time(label)
    timeLabels[label] = now
  }

  console.timeLog = (label = 'default') => {
    timeLog(label)
    if (!(label in timeLabels))
      sendLog('stderr', `Timer "${label}" does not exist`)
    else
      sendLog('stdout', `${label}: ${timeLabels[label]} ms`)
  }

  console.timeEnd = (label = 'default') => {
    const end = performance.now()
    timeEnd(label)
    const start = timeLabels[label]
    if (!(label in timeLabels)) {
      sendLog('stderr', `Timer "${label}" does not exist`)
    }
    else if (start) {
      const duration = end - start
      sendLog('stdout', `${label}: ${duration} ms`)
    }
  }

  const countLabels: Record<string, number> = {}

  console.count = (label = 'default') => {
    const counter = (countLabels[label] ?? 0) + 1
    countLabels[label] = counter
    sendLog('stdout', `${label}: ${counter}`)
    return count(label)
  }

  console.countReset = (label = 'default') => {
    countLabels[label] = 0
    return countReset(label)
  }
}
