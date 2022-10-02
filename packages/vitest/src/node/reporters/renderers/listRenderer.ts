import c from 'picocolors'
import cliTruncate from 'cli-truncate'
import stripAnsi from 'strip-ansi'
import type { Benchmark, BenchmarkResult, SuiteHooks, Task, VitestRunMode } from '../../../types'
import { clearInterval, getTests, getTypecheckTests, isTypecheckTest, notNullish, setInterval } from '../../../utils'
import { F_RIGHT } from '../../../utils/figures'
import type { Logger } from '../../logger'
import { getCols, getHookStateSymbol, getStateSymbol } from './utils'

export interface ListRendererOptions {
  renderSucceed?: boolean
  logger: Logger
  showHeap: boolean
  mode: VitestRunMode
}

const DURATION_LONG = 300

const outputMap = new WeakMap<Task, string>()

function formatFilepath(path: string) {
  const lastSlash = Math.max(path.lastIndexOf('/') + 1, 0)
  const basename = path.slice(lastSlash)
  let firstDot = basename.indexOf('.')
  if (firstDot < 0)
    firstDot = basename.length
  firstDot += lastSlash

  return c.dim(path.slice(0, lastSlash)) + path.slice(lastSlash, firstDot) + c.dim(path.slice(firstDot))
}

function formatNumber(number: number) {
  const res = String(number.toFixed(number < 100 ? 4 : 2)).split('.')
  return res[0].replace(/(?=(?:\d{3})+$)(?!\b)/g, ',')
    + (res[1] ? `.${res[1]}` : '')
}

function renderHookState(task: Task, hookName: keyof SuiteHooks, level = 0) {
  const state = task.result?.hooks?.[hookName]
  if (state && state === 'run')
    return `${'  '.repeat(level)} ${getHookStateSymbol(task, hookName)} ${c.dim(`[ ${hookName} ]`)}`

  return ''
}

function renderBenchmarkItems(result: BenchmarkResult) {
  return [
    result.name,
    formatNumber(result.hz || 0),
    formatNumber(result.p99 || 0),
    `±${result.rme.toFixed(2)}%`,
    result.samples.length.toString(),
  ]
}

function renderBenchmark(task: Benchmark, tasks: Task[]): string {
  const result = task.result?.benchmark
  if (!result)
    return task.name

  const benchs = tasks
    .map(i => i.type === 'benchmark' ? i.result?.benchmark : undefined)
    .filter(notNullish)

  const allItems = benchs.map(renderBenchmarkItems)
  const items = renderBenchmarkItems(result)
  const padded = items.map((i, idx) => {
    const width = Math.max(...allItems.map(i => i[idx].length))
    return idx
      ? i.padStart(width, ' ')
      : i.padEnd(width, ' ') // name
  })

  return [
    padded[0], // name
    c.dim('  '),
    c.blue(padded[1]),
    c.dim(' ops/sec '),
    c.cyan(padded[3]),
    c.dim(` (${padded[4]} samples)`),
    result.rank === 1
      ? c.bold(c.green(' fastest'))
      : result.rank === benchs.length && benchs.length > 2
        ? c.bold(c.gray(' slowest'))
        : '',
  ].join('')
}

export function renderTree(tasks: Task[], options: ListRendererOptions, level = 0) {
  let output: string[] = []

  for (const task of tasks) {
    let suffix = ''
    const prefix = ` ${getStateSymbol(task)} `

    if (task.type === 'test' && task.result?.retryCount && task.result.retryCount > 1)
      suffix += c.yellow(` (retry x${task.result.retryCount})`)

    if (task.type === 'suite' && !isTypecheckTest(task)) {
      const tests = options.mode === 'typecheck' ? getTypecheckTests(task) : getTests(task)
      suffix += c.dim(` (${tests.length})`)
    }

    if (task.mode === 'skip' || task.mode === 'todo')
      suffix += ` ${c.dim(c.gray('[skipped]'))}`

    if (task.result?.duration != null) {
      if (task.result.duration > DURATION_LONG)
        suffix += c.yellow(` ${Math.round(task.result.duration)}${c.dim('ms')}`)
    }

    if (options.showHeap && task.result?.heap != null)
      suffix += c.magenta(` ${Math.floor(task.result.heap / 1024 / 1024)} MB heap used`)

    let name = task.name
    if (level === 0)
      name = formatFilepath(name)

    const padding = '  '.repeat(level)
    const body = task.type === 'benchmark'
      ? renderBenchmark(task, tasks)
      : name

    output.push(padding + prefix + body + suffix)

    if ((task.result?.state !== 'pass') && outputMap.get(task) != null) {
      let data: string | undefined = outputMap.get(task)
      if (typeof data === 'string') {
        data = stripAnsi(data.trim().split('\n').filter(Boolean).pop()!)
        if (data === '')
          data = undefined
      }

      if (data != null) {
        const out = `${'  '.repeat(level)}${F_RIGHT} ${data}`
        output.push(`   ${c.gray(cliTruncate(out, getCols(-3)))}`)
      }
    }

    output = output.concat(renderHookState(task, 'beforeAll', level + 1))
    output = output.concat(renderHookState(task, 'beforeEach', level + 1))
    if (task.type === 'suite' && task.tasks.length > 0) {
      if ((task.result?.state === 'fail' || task.result?.state === 'run' || options.renderSucceed))
        output = output.concat(renderTree(task.tasks, options, level + 1))
    }
    output = output.concat(renderHookState(task, 'afterAll', level + 1))
    output = output.concat(renderHookState(task, 'afterEach', level + 1))
  }

  // TODO: moving windows
  return output.filter(Boolean).join('\n')
}

export const createListRenderer = (_tasks: Task[], options: ListRendererOptions) => {
  let tasks = _tasks
  let timer: any

  const log = options.logger.logUpdate

  function update() {
    log(renderTree(tasks, options))
  }

  return {
    start() {
      if (timer)
        return this
      timer = setInterval(update, 200)
      return this
    },
    update(_tasks: Task[]) {
      tasks = _tasks
      update()
      return this
    },
    async stop() {
      if (timer) {
        clearInterval(timer)
        timer = undefined
      }
      log.clear()
      options.logger.log(renderTree(tasks, options))
      return this
    },
    clear() {
      log.clear()
    },
  }
}
