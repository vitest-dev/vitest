import c from 'picocolors'
import cliTruncate from 'cli-truncate'
import stripAnsi from 'strip-ansi'
import type { Benchmark, BenchmarkResult, Task } from '../../../../types'
import { getTests, notNullish } from '../../../../utils'
import { F_RIGHT } from '../../../../utils/figures'
import type { Logger } from '../../../logger'
import { getCols, getStateSymbol } from '../../renderers/utils'

export interface ListRendererOptions {
  renderSucceed?: boolean
  logger: Logger
  showHeap: boolean
  slowTestThreshold: number
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

const tableHead = ['name', 'hz', 'min', 'max', 'mean', 'p75', 'p99', 'p995', 'p999', 'rme', 'samples']

function renderTableHead(tasks: Task[]) {
  const benches = tasks
    .map(i => i.meta?.benchmark ? i.result?.benchmark : undefined)
    .filter(notNullish)
  const allItems = benches.map(renderBenchmarkItems).concat([tableHead])
  return `${' '.repeat(3)}${tableHead.map((i, idx) => {
    const width = Math.max(...allItems.map(i => i[idx].length))
    return idx
      ? i.padStart(width, ' ')
      : i.padEnd(width, ' ') // name
  }).map(c.bold).join('  ')}`
}

function renderBenchmarkItems(result: BenchmarkResult) {
  return [
    result.name,
    formatNumber(result.hz || 0),
    formatNumber(result.min || 0),
    formatNumber(result.max || 0),
    formatNumber(result.mean || 0),
    formatNumber(result.p75 || 0),
    formatNumber(result.p99 || 0),
    formatNumber(result.p995 || 0),
    formatNumber(result.p999 || 0),
    `±${(result.rme || 0).toFixed(2)}%`,
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
  const allItems = benches.map(renderBenchmarkItems).concat([tableHead])
  const items = renderBenchmarkItems(result)
  const padded = items.map((i, idx) => {
    const width = Math.max(...allItems.map(i => i[idx].length))
    return idx
      ? i.padStart(width, ' ')
      : i.padEnd(width, ' ') // name
  })

  return [
    padded[0], // name
    c.blue(padded[1]), // hz
    c.cyan(padded[2]), // min
    c.cyan(padded[3]), // max
    c.cyan(padded[4]), // mean
    c.cyan(padded[5]), // p75
    c.cyan(padded[6]), // p99
    c.cyan(padded[7]), // p995
    c.cyan(padded[8]), // p999
    c.dim(padded[9]), // rem
    c.dim(padded[10]), // sample
    result.rank === 1
      ? c.bold(c.green(' fastest'))
      : (result.rank === benches.length && benches.length > 2)
          ? c.bold(c.gray(' slowest'))
          : '',
  ].join('  ')
}

export function renderTree(tasks: Task[], options: ListRendererOptions, level = 0): string {
  const output: string[] = []

  let idx = 0
  for (const task of tasks) {
    const padding = '  '.repeat(level ? 1 : 0)
    let prefix = ''
    if (idx === 0 && task.meta?.benchmark)
      prefix += `${renderTableHead(tasks)}\n${padding}`

    prefix += ` ${getStateSymbol(task)} `

    let suffix = ''
    if (task.type === 'suite')
      suffix += c.dim(` (${getTests(task).length})`)

    if (task.mode === 'skip' || task.mode === 'todo')
      suffix += ` ${c.dim(c.gray('[skipped]'))}`

    if (task.result?.duration != null) {
      if (task.result.duration > options.slowTestThreshold)
        suffix += c.yellow(` ${Math.round(task.result.duration)}${c.dim('ms')}`)
    }

    if (options.showHeap && task.result?.heap != null)
      suffix += c.magenta(` ${Math.floor(task.result.heap / 1024 / 1024)} MB heap used`)

    let name = task.name
    if (level === 0)
      name = formatFilepath(name)

    const body = task.meta?.benchmark
      ? renderBenchmark(task as Benchmark, tasks)
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

    if (task.type === 'suite' && task.tasks.length > 0) {
      if (task.result?.state)
        output.push(renderTree(task.tasks, options, level + 1))
    }
    idx++
  }

  return output.filter(Boolean).join('\n')
}

export function createTableRenderer(_tasks: Task[], options: ListRendererOptions) {
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
