import type { TestBenchmark, TestBenchmarkTask } from '../../../packages/vitest/src/runtime/runner/types'
import { stripVTControlCharacters } from 'node:util'
import { describe, expect, it } from 'vitest'
import { BaseReporter } from '../../../packages/vitest/src/node/reporters/base'
import {
  computeRelativeScores,
  formatRelativeScore,
  renderBenchmarkTableText,
} from '../../../packages/vitest/src/node/reporters/renderers/benchmark-table'

function stats(mean: number) {
  return {
    aad: 0,
    critical: 0,
    df: 0,
    mad: 0,
    max: mean,
    mean,
    min: mean,
    moe: 0,
    p50: mean,
    p75: mean,
    p99: mean,
    p995: mean,
    p999: mean,
    rme: 0,
    samples: undefined,
    samplesCount: 10,
    sd: 0,
    sem: 0,
    variance: 0,
  }
}

function task(name: string, mean: number, rank: number): TestBenchmarkTask {
  return {
    name,
    latency: stats(mean),
    throughput: stats(mean > 0 ? 1 / mean : 0),
    period: mean,
    totalTime: mean * 10,
    rank,
  }
}

function bench(tasks: TestBenchmarkTask[]): TestBenchmark[] {
  return [{ name: 'group', tasks }]
}

describe('computeRelativeScores', () => {
  it('scores each task against the fastest one', () => {
    const tasks = [task('fast', 100, 1), task('slow', 150, 2)]
    expect(computeRelativeScores(tasks)).toEqual([1, 100 / 150])
  })

  it('returns no scores for a single task', () => {
    expect(computeRelativeScores([task('only', 100, 1)])).toEqual([undefined])
  })

  it('returns no scores when means are missing or invalid', () => {
    const tasks = [task('a', 0, 1), task('b', Number.NaN, 2)]
    expect(computeRelativeScores(tasks)).toEqual([undefined, undefined])
  })

  it('skips only the invalid tasks', () => {
    const tasks = [task('fast', 100, 1), task('invalid', 0, 2), task('slow', 400, 3)]
    expect(computeRelativeScores(tasks)).toEqual([1, undefined, 0.25])
  })

  it('handles an empty task list', () => {
    expect(computeRelativeScores([])).toEqual([])
  })
})

describe('formatRelativeScore', () => {
  it('formats the score with two decimals', () => {
    expect(formatRelativeScore(1.5)).toBe('[1.50x]')
    expect(formatRelativeScore(1)).toBe('[1.00x]')
  })

  it('returns an empty string for undefined', () => {
    expect(formatRelativeScore(undefined)).toBe('')
  })
})

describe('renderBenchmarkTableText', () => {
  it('adds relative scores aligned in their own column and keeps fastest/slowest suffixes', () => {
    const output = renderBenchmarkTableText(bench([
      task('fast', 100, 1),
      task('mid', 200, 2),
      task('slow', 400, 3),
    ]))
    const lines = output.split('\n')
    expect(lines[1]).toContain('[1.00x]')
    expect(lines[2]).toContain('[0.50x]')
    expect(lines[3]).toContain('[0.25x]')
    expect(lines[1].endsWith('fastest')).toBe(true)
    expect(lines[3].endsWith('slowest')).toBe(true)
    // aligned in a shared column
    expect(lines[1].indexOf('[1.00x]')).toBe(lines[2].indexOf('[0.50x]'))
    expect(lines[2].indexOf('[0.50x]')).toBe(lines[3].indexOf('[0.25x]'))
    // plain text output carries no ANSI codes
    expect(stripVTControlCharacters(output)).toBe(output)
  })

  it('prints no score column for a single-row table', () => {
    const output = renderBenchmarkTableText(bench([task('only', 100, 1)]))
    expect(output).not.toContain('[1.00x]')
    expect(output).not.toContain('fastest')
  })
})

describe('printBenchmarkTable (default reporter path)', () => {
  const callPrint = (benchmarks: TestBenchmark[], logs: string[]) => {
    const fakeThis = { log: (msg: string) => logs.push(msg) }
    ;(BaseReporter.prototype as any).printBenchmarkTable.call(fakeThis, benchmarks, '', 'name')
  }

  it('renders relative scores between name and fastest/slowest suffixes', () => {
    const logs: string[] = []
    callPrint(bench([task('fast', 100, 1), task('slow', 200, 2)]), logs)
    const lines = logs.join('\n').split('\n')
    const fastRow = lines.find(l => l.includes('fast'))!
    const slowRow = lines.find(l => l.includes('slow'))!
    expect(fastRow).toContain('[1.00x]')
    expect(slowRow).toContain('[0.50x]')
    expect(fastRow).toContain('fastest')
    expect(slowRow).not.toContain('slowest') // only marked for 3+ rows
    // score index in the stripped row matches between rows (aligned column)
    const stripped = (s: string) => stripVTControlCharacters(s)
    expect(stripped(fastRow).indexOf('[1.00x]')).toBe(stripped(slowRow).indexOf('[0.50x]'))
  })

  it('renders no score column for a single row', () => {
    const logs: string[] = []
    callPrint(bench([task('only', 100, 1)]), logs)
    expect(logs.join('\n')).not.toContain('[1.00x]')
  })
})
