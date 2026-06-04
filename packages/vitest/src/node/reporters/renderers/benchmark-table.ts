import type { TestBenchmark, TestBenchmarkTask } from '../../../runtime/runner/types'
import { stripVTControlCharacters } from 'node:util'

export const BENCH_TABLE_HEAD: string[] = [
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

function formatBenchNumber(number: number): string {
  const res = String(number.toFixed(number < 100 ? 4 : 2)).split('.')
  return res[0].replace(/(?=(?:\d{3})+$)\B/g, ',') + (res[1] ? `.${res[1]}` : '')
}

// Plain-text rendering of the benchmark table (no ANSI colors, no indent).
// Used by the junit reporter to embed benchmark data in <system-out>.
export function renderBenchmarkTableText(
  benchmarks: readonly TestBenchmark[],
  columnName = 'name',
): string {
  const lines: string[] = []
  for (const benchmark of benchmarks) {
    const { tasks } = benchmark
    if (tasks.length === 0) {
      continue
    }
    if (lines.length > 0) {
      lines.push('')
    }
    const rows = tasks.map(renderBenchmarkRow)
    const head = [columnName, ...BENCH_TABLE_HEAD]
    const widths = computeBenchColumnWidths(head, rows)
    lines.push(padBenchRow(head, widths).join('  '))
    for (const task of tasks) {
      let row = padBenchRow(renderBenchmarkRow(task), widths).join('  ')
      if (task.rank === 1 && tasks.length > 1) {
        row += '   fastest'
      }
      if (task.rank === tasks.length && tasks.length > 2) {
        row += '   slowest'
      }
      lines.push(row)
    }
  }
  return lines.join('\n')
}

export function renderBenchmarkRow(task: TestBenchmarkTask): string[] {
  return [
    task.name,
    formatBenchNumber(task.throughput.mean || 0),
    formatBenchNumber(task.latency.min || 0),
    formatBenchNumber(task.latency.max || 0),
    formatBenchNumber(task.latency.mean || 0),
    formatBenchNumber(task.latency.p75 || 0),
    formatBenchNumber(task.latency.p99 || 0),
    formatBenchNumber(task.latency.p995 || 0),
    formatBenchNumber(task.latency.p999 || 0),
    `\u00B1${(task.latency.rme || 0).toFixed(2)}%`,
    String(task.latency.samplesCount || 0),
  ]
}

export function computeBenchColumnWidths(header: string[], rows: string[][]): number[] {
  const allRows = [header, ...rows]
  return Array.from(header, (_, i) => Math.max(...allRows.map(row => stripVTControlCharacters(row[i]).length)))
}

export function padBenchRow(row: string[], widths: number[]): string[] {
  return row.map(
    (v, i) => (i === 0 ? v.padEnd(widths[i]) : v.padStart(widths[i])),
  )
}
