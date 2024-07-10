import c from 'tinyrainbow'
import cliTruncate from 'cli-truncate'
import stripAnsi from 'strip-ansi'
import type { BenchmarkResult, Task } from '../../../../types'
import { getTests, notNullish } from '../../../../utils'
import { F_RIGHT } from '../../../../utils/figures'
import type { Logger } from '../../../logger'
import { getCols, getStateSymbol } from '../../renderers/utils'
import type { FlatBenchmarkReport } from '.'

export interface TableRendererOptions {
  renderSucceed?: boolean
  logger: Logger
  showHeap: boolean
  slowTestThreshold: number
  compare?: FlatBenchmarkReport
}

const outputMap = new WeakMap<Task, string>()

function formatFilepath(path: string) {
  const lastSlash = Math.max(path.lastIndexOf('/') + 1, 0)
  const basename = path.slice(lastSlash)
  let firstDot = basename.indexOf('.')
  if (firstDot < 0) {
    firstDot = basename.length
  }
  firstDot += lastSlash

  return (
    c.dim(path.slice(0, lastSlash))
    + path.slice(lastSlash, firstDot)
    + c.dim(path.slice(firstDot))
  )
}

function formatNumber(number: number) {
  const res = String(number.toFixed(number < 100 ? 4 : 2)).split('.')
  return (
    res[0].replace(/(?=(?:\d{3})+$)\B/g, ',') + (res[1] ? `.${res[1]}` : '')
  )
}

const tableHead = [
  'name',
  'hz',
  'min',
  'max',
  'mean',
  'p75',
  'p99',
  'p995',
  'p999',
  'rme',
  'samples',
]

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

function computeColumnWidths(results: BenchmarkResult[]): number[] {
  const rows = [tableHead, ...results.map(v => renderBenchmarkItems(v))]
  return Array.from(tableHead, (_, i) =>
    Math.max(...rows.map(row => stripAnsi(row[i]).length)))
}

function padRow(row: string[], widths: number[]) {
  return row.map(
    (v, i) => (i ? v.padStart(widths[i], ' ') : v.padEnd(widths[i], ' ')), // name
  )
}

function renderTableHead(widths: number[]) {
  return ' '.repeat(3) + padRow(tableHead, widths).map(c.bold).join('  ')
}

function renderBenchmark(result: BenchmarkResult, widths: number[]) {
  const padded = padRow(renderBenchmarkItems(result), widths)
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
  ].join('  ')
}

export function renderTree(
  tasks: Task[],
  options: TableRendererOptions,
  level = 0,
  shallow = false,
): string {
  const output: string[] = []

  const benchMap: Record<
    string,
    { current: BenchmarkResult; baseline?: BenchmarkResult }
  > = {}
  for (const t of tasks) {
    if (t.meta.benchmark && t.result?.benchmark) {
      benchMap[t.id] = {
        current: t.result.benchmark,
      }
      const baseline = options.compare?.[t.id]
      if (baseline) {
        benchMap[t.id].baseline = {
          ...baseline,
          samples: Array(baseline.sampleCount),
        }
      }
    }
  }
  const benchCount = Object.entries(benchMap).length

  // compute column widths
  const columnWidths = computeColumnWidths(
    Object.values(benchMap)
      .flatMap(v => [v.current, v.baseline])
      .filter(notNullish),
  )

  let idx = 0
  for (const task of tasks) {
    const padding = '  '.repeat(level ? 1 : 0)
    let prefix = ''
    if (idx === 0 && task.meta?.benchmark) {
      prefix += `${renderTableHead(columnWidths)}\n${padding}`
    }

    prefix += ` ${getStateSymbol(task)} `

    let suffix = ''
    if (task.type === 'suite') {
      suffix += c.dim(` (${getTests(task).length})`)
    }

    if (task.mode === 'skip' || task.mode === 'todo') {
      suffix += ` ${c.dim(c.gray('[skipped]'))}`
    }

    if (task.result?.duration != null) {
      if (task.result.duration > options.slowTestThreshold) {
        suffix += c.yellow(
          ` ${Math.round(task.result.duration)}${c.dim('ms')}`,
        )
      }
    }

    if (options.showHeap && task.result?.heap != null) {
      suffix += c.magenta(
        ` ${Math.floor(task.result.heap / 1024 / 1024)} MB heap used`,
      )
    }

    let name = task.name
    if (level === 0) {
      name = formatFilepath(name)
    }

    const bench = benchMap[task.id]
    if (bench) {
      let body = renderBenchmark(bench.current, columnWidths)
      if (options.compare && bench.baseline) {
        if (bench.current.hz) {
          const diff = bench.current.hz / bench.baseline.hz
          const diffFixed = diff.toFixed(2)
          if (diffFixed === '1.0.0') {
            body += `  ${c.gray(`[${diffFixed}x]`)}`
          }
          if (diff > 1) {
            body += `  ${c.blue(`[${diffFixed}x] ⇑`)}`
          }
          else {
            body += `  ${c.red(`[${diffFixed}x] ⇓`)}`
          }
        }
        output.push(padding + prefix + body + suffix)
        const bodyBaseline = renderBenchmark(bench.baseline, columnWidths)
        output.push(`${padding}   ${bodyBaseline}  ${c.dim('(baseline)')}`)
      }
      else {
        if (bench.current.rank === 1 && benchCount > 1) {
          body += `  ${c.bold(c.green(' fastest'))}`
        }

        if (bench.current.rank === benchCount && benchCount > 2) {
          body += `  ${c.bold(c.gray(' slowest'))}`
        }

        output.push(padding + prefix + body + suffix)
      }
    }
    else {
      output.push(padding + prefix + name + suffix)
    }

    if (task.result?.state !== 'pass' && outputMap.get(task) != null) {
      let data: string | undefined = outputMap.get(task)
      if (typeof data === 'string') {
        data = stripAnsi(data.trim().split('\n').filter(Boolean).pop()!)
        if (data === '') {
          data = undefined
        }
      }

      if (data != null) {
        const out = `${'  '.repeat(level)}${F_RIGHT} ${data}`
        output.push(`   ${c.gray(cliTruncate(out, getCols(-3)))}`)
      }
    }

    if (!shallow && task.type === 'suite' && task.tasks.length > 0) {
      if (task.result?.state) {
        output.push(renderTree(task.tasks, options, level + 1))
      }
    }
    idx++
  }

  return output.filter(Boolean).join('\n')
}

export function createTableRenderer(
  _tasks: Task[],
  options: TableRendererOptions,
) {
  let tasks = _tasks
  let timer: any

  const log = options.logger.logUpdate

  function update() {
    log(renderTree(tasks, options))
  }

  return {
    start() {
      if (timer) {
        return this
      }
      timer = setInterval(update, 200)
      return this
    },
    update(_tasks: Task[]) {
      tasks = _tasks
      update()
      return this
    },
    stop() {
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
