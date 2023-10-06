import type { Custom } from '@vitest/runner'
import { getCurrentSuite } from '@vitest/runner'
import { createChainable } from '@vitest/runner/utils'
import { noop } from '@vitest/utils'
import type { BenchFunction, BenchOptions, BenchmarkAPI } from '../types'
import { isRunningInBenchmark } from '../utils'

const benchFns = new WeakMap<Custom, BenchFunction>()
const benchOptsMap = new WeakMap()

export function getBenchOptions(key: Custom): BenchOptions {
  return benchOptsMap.get(key)
}

export function getBenchFn(key: Custom): BenchFunction {
  return benchFns.get(key)!
}

export const bench = createBenchmark(
  function (name, fn: BenchFunction = noop, options: BenchOptions = {}) {
    if (!isRunningInBenchmark())
      throw new Error('`bench()` is only available in benchmark mode.')

    const task = getCurrentSuite().task(formatName(name), {
      ...this,
      meta: {
        benchmark: true,
      },
    })
    benchFns.set(task, fn)
    benchOptsMap.set(task, options)
  },
)

function createBenchmark(fn: (
  (
    this: Record<'skip' | 'only' | 'todo', boolean | undefined>,
    name: string | Function,
    fn?: BenchFunction,
    options?: BenchOptions
  ) => void
)) {
  const benchmark = createChainable(
    ['skip', 'only', 'todo'],
    fn,
  ) as BenchmarkAPI

  benchmark.skipIf = (condition: any) => (condition ? benchmark.skip : benchmark) as BenchmarkAPI
  benchmark.runIf = (condition: any) => (condition ? benchmark : benchmark.skip) as BenchmarkAPI

  return benchmark as BenchmarkAPI
}

function formatName(name: string | Function) {
  return typeof name === 'string' ? name : name instanceof Function ? (name.name || '<anonymous>') : String(name)
}
