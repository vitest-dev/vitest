import c from 'picocolors'
import cliTruncate from 'cli-truncate'
import stripAnsi from 'strip-ansi'
import type { Benchmark, BenchmarkResult, SuiteHooks, Task, VitestRunMode } from '../../../types'
import { getTests, notNullish } from '../../../utils'
import { F_RIGHT } from '../../../utils/figures'
import type { Logger } from '../../logger'
import { formatProjectName, getCols, getHookStateSymbol, getStateSymbol } from './utils'

export interface ListRendererOptions {
  renderSucceed?: boolean
  logger: Logger
  showHeap: boolean
  slowTestThreshold: number
  mode: VitestRunMode
}

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

function renderHookState(task: Task, hookName: keyof SuiteHooks, level = 0): string {
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

  const benches = tasks
    .map(i => i.meta?.benchmark ? i.result?.benchmark : undefined)
    .filter(notNullish)

  const allItems = benches.map(renderBenchmarkItems)
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
      : (result.rank === benches.length && benches.length > 2)
          ? c.bold(c.gray(' slowest'))
          : '',
  ].join('')
}

export function renderTree(tasks: Task[], options: ListRendererOptions, level = 0, maxRows?: number): string {
  const output: string[] = []
  let currentRowCount = 0

  // Go through tasks in reverse order since maxRows is used to bail out early when limit is reached
  for (const task of [...tasks].reverse()) {
    const taskOutput = []

    let suffix = ''
    let prefix = ` ${getStateSymbol(task)} `

    if (level === 0 && task.type === 'suite' && task.projectName)
      prefix += formatProjectName(task.projectName)

    if (task.type === 'test' && task.result?.retryCount && task.result.retryCount > 0)
      suffix += c.yellow(` (retry x${task.result.retryCount})`)

    if (task.type === 'suite') {
      const tests = getTests(task)
      suffix += c.dim(` (${tests.length})`)
    }

    if (task.mode === 'skip' || task.mode === 'todo')
      suffix += ` ${c.dim(c.gray('[skipped]'))}`

    if (task.type === 'test' && task.result?.repeatCount && task.result.repeatCount > 0)
      suffix += c.yellow(` (repeat x${task.result.repeatCount})`)

    if (task.result?.duration != null) {
      if (task.result.duration > options.slowTestThreshold)
        suffix += c.yellow(` ${Math.round(task.result.duration)}${c.dim('ms')}`)
    }

    if (options.showHeap && task.result?.heap != null)
      suffix += c.magenta(` ${Math.floor(task.result.heap / 1024 / 1024)} MB heap used`)

    let name = task.name
    if (level === 0)
      name = formatFilepath(name)

    const padding = '  '.repeat(level)
    const body = task.meta?.benchmark
      ? renderBenchmark(task as Benchmark, tasks)
      : name

    taskOutput.push(padding + prefix + body + suffix)

    if ((task.result?.state !== 'pass') && outputMap.get(task) != null) {
      let data: string | undefined = outputMap.get(task)
      if (typeof data === 'string') {
        data = stripAnsi(data.trim().split('\n').filter(Boolean).pop()!)
        if (data === '')
          data = undefined
      }

      if (data != null) {
        const out = `${'  '.repeat(level)}${F_RIGHT} ${data}`
        taskOutput.push(`   ${c.gray(cliTruncate(out, getCols(-3)))}`)
      }
    }

    taskOutput.push(renderHookState(task, 'beforeAll', level + 1))
    taskOutput.push(renderHookState(task, 'beforeEach', level + 1))
    if (task.type === 'suite' && task.tasks.length > 0) {
      if ((task.result?.state === 'fail' || task.result?.state === 'run' || options.renderSucceed)) {
        if (options.logger.ctx.config.hideSkippedTests) {
          const filteredTasks = task.tasks.filter(t => t.mode !== 'skip' && t.mode !== 'todo')
          taskOutput.push(renderTree(filteredTasks, options, level + 1, maxRows))
        }
        else {
          taskOutput.push(renderTree(task.tasks, options, level + 1, maxRows))
        }
      }
    }
    taskOutput.push(renderHookState(task, 'afterAll', level + 1))
    taskOutput.push(renderHookState(task, 'afterEach', level + 1))

    const rows = taskOutput.filter(Boolean)
    output.push(rows.join('\n'))
    currentRowCount += rows.length

    if (maxRows && currentRowCount >= maxRows)
      break
  }

  // TODO: moving windows
  return output.reverse().join('\n')
}

export function createListRenderer(_tasks: Task[], options: ListRendererOptions) {
  let tasks = _tasks
  let timer: any

  const log = options.logger.logUpdate

  function update() {
    if (options.logger.ctx.config.hideSkippedTests) {
      const filteredTasks = tasks.filter(t => t.mode !== 'skip' && t.mode !== 'todo')
      log(renderTree(
        filteredTasks,
        options,
        0,
        // log-update already limits the amount of printed rows to fit the current terminal
        // but we can optimize performance by doing it ourselves
        process.stdout.rows,
      ))
    }
    else {
      log(renderTree(
        tasks,
        options,
        0,
        // log-update already limits the amount of printed rows to fit the current terminal
        // but we can optimize performance by doing it ourselves
        process.stdout.rows,
      ))
    }
  }

  return {
    start() {
      if (timer)
        return this
      timer = setInterval(update, 16)
      return this
    },
    update(_tasks: Task[]) {
      tasks = _tasks
      return this
    },
    async stop() {
      if (timer) {
        clearInterval(timer)
        timer = undefined
      }
      log.clear()
      if (options.logger.ctx.config.hideSkippedTests) {
        const filteredTasks = tasks.filter(t => t.mode !== 'skip' && t.mode !== 'todo')
        // Note that at this point the renderTree should output all tasks
        options.logger.log(renderTree(filteredTasks, options))
      }
      else {
        // Note that at this point the renderTree should output all tasks
        options.logger.log(renderTree(tasks, options))
      }
      return this
    },
    clear() {
      log.clear()
    },
  }
}
