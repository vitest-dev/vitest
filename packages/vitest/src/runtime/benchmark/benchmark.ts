import BenchmarkLib from 'tinybench'
import type {
  BenchFunction,
  Benchmark,
  BenchmarkCollector,
  BenchmarkFactory,
  BenchmarkOptions,
  File,
} from '../../types'
import { benchmarkContext, collectBenchmark, setBenchmark } from './context'

// apis
export const benchmark = (name: string, factory: BenchmarkFactory = () => { }, options?: BenchmarkOptions) => {
  return createBenchmarkCollector(name, factory, options)
}

export const defaultBenchmark = benchmark('')

export function clearBenchmarkContext() {
  defaultBenchmark.clear()
  benchmarkContext.currentBenchmark = defaultBenchmark
}

function createBenchmarkCollector(name: string, factory: BenchmarkFactory = () => { }, options?: BenchmarkOptions): BenchmarkCollector {
  const tasks: (BenchmarkCollector)[] = []
  let benchmark: Benchmark
  let benchmarkLib: BenchmarkLib.Suite

  initBenchmark()

  const bench = (name: string, fn: BenchFunction, options?: BenchmarkOptions) => {
    benchmarkLib.add(name, fn, options)
  }

  const collector: BenchmarkCollector = {
    type: 'benchmark-collector',
    name,
    mode: 'run',
    tasks,
    bench,
    collect,
    clear,
  }

  function initBenchmark() {
    benchmark = {
      type: 'benchmark',
      id: '',
      name,
      mode: 'run',
      tasks: [],
    }
    benchmarkLib = new BenchmarkLib.Suite(name, options)
    setBenchmark(benchmark, benchmarkLib)
  }

  function clear() {
    tasks.length = 0
    initBenchmark()
  }

  async function collect(file?: File): Promise<Benchmark> {
    if (factory)
      await factory(bench)

    const allChildren: (Benchmark | BenchmarkCollector)[] = []

    for (const i of tasks)
      allChildren.push(i.type === 'benchmark-collector' ? await i.collect(file) : i)

    benchmark.file = file
    benchmark.tasks = allChildren as Benchmark[]

    ;(allChildren as Benchmark[]).forEach((task) => {
      task.benchmark = benchmark
      if (file)
        task.file = file
    })

    return benchmark
  }

  collectBenchmark(collector)

  return collector
}
