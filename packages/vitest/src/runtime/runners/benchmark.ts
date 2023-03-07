import type { Suite, Task, VitestRunner, VitestRunnerImportSource } from '@vitest/runner'
import { updateTask as updateRunnerTask } from '@vitest/runner'
import { createDefer, getSafeTimers } from '@vitest/utils'
import { getBenchFn, getBenchOptions } from '../benchmark'
import { getWorkerState } from '../../utils'
import type { BenchTask, Benchmark, BenchmarkResult } from '../../types/benchmark'
import type { ResolvedConfig } from '../../types/config'
import type { VitestExecutor } from '../execute'

async function importTinybench() {
  if (!globalThis.EventTarget)
    await import('event-target-polyfill' as any)

  return (await import('tinybench'))
}

function createBenchmarkResult(name: string): BenchmarkResult {
  return {
    name,
    rank: 0,
    rme: 0,
    samples: [] as number[],
  } as BenchmarkResult
}

async function runBenchmarkSuite(suite: Suite, runner: VitestRunner) {
  const { Task, Bench } = await importTinybench()
  const start = performance.now()

  const benchmarkGroup: Benchmark[] = []
  const benchmarkSuiteGroup = []
  for (const task of suite.tasks) {
    if (task.mode !== 'run')
      continue

    if (task.meta?.benchmark)
      benchmarkGroup.push(task as Benchmark)
    else if (task.type === 'suite')
      benchmarkSuiteGroup.push(task)
  }

  if (benchmarkSuiteGroup.length)
    await Promise.all(benchmarkSuiteGroup.map(subSuite => runBenchmarkSuite(subSuite, runner)))

  if (benchmarkGroup.length) {
    const defer = createDefer()
    const benchmarkMap: Record<string, Benchmark> = {}
    suite.result = {
      state: 'run',
      startTime: start,
      benchmark: createBenchmarkResult(suite.name),
    }
    updateTask(suite)
    benchmarkGroup.forEach((benchmark, idx) => {
      const options = getBenchOptions(benchmark)
      const benchmarkInstance = new Bench(options)

      const benchmarkFn = getBenchFn(benchmark)

      benchmark.result = {
        state: 'run',
        startTime: start,
        benchmark: createBenchmarkResult(benchmark.name),
      }
      const id = idx.toString()
      benchmarkMap[id] = benchmark

      const task = new Task(benchmarkInstance, id, benchmarkFn)
      benchmark.meta.task = task
      updateTask(benchmark)
    })

    benchmarkGroup.forEach((benchmark) => {
      benchmark.meta.task!.addEventListener('complete', (e) => {
        const task = e.task
        const _benchmark = benchmarkMap[task.name || '']
        if (_benchmark) {
          const taskRes = task.result!
          const result = _benchmark.result!.benchmark!
          Object.assign(result, taskRes)
          updateTask(_benchmark)
        }
      })
      benchmark.meta.task!.addEventListener('error', (e) => {
        const task = e.task
        const _benchmark = benchmarkMap[task.name || '']
        defer.reject(_benchmark ? task.result!.error : e)
      })
    })

    Promise.all(benchmarkGroup.map(async (benchmark) => {
      await benchmark.meta.task!.warmup()
      const { setTimeout } = getSafeTimers()
      return await new Promise<BenchTask>(resolve => setTimeout(async () => {
        resolve(await benchmark.meta.task!.run())
      }))
    })).then((tasks) => {
      suite.result!.duration = performance.now() - start
      suite.result!.state = 'pass'

      tasks
        .sort((a, b) => a.result!.mean - b.result!.mean)
        .forEach((cycle, idx) => {
          const benchmark = benchmarkMap[cycle.name || '']
          benchmark.result!.state = 'pass'
          if (benchmark) {
            const result = benchmark.result!.benchmark!
            result.rank = Number(idx) + 1
            updateTask(benchmark)
          }
        })
      updateTask(suite)
      defer.resolve(null)
    })

    await defer
  }

  function updateTask(task: Task) {
    updateRunnerTask(task, runner)
  }
}

export class NodeBenchmarkRunner implements VitestRunner {
  private __vitest_executor!: VitestExecutor

  constructor(public config: ResolvedConfig) {}

  importFile(filepath: string, source: VitestRunnerImportSource): unknown {
    if (source === 'setup')
      getWorkerState().moduleCache.delete(filepath)
    return this.__vitest_executor.executeId(filepath)
  }

  async runSuite(suite: Suite): Promise<void> {
    await runBenchmarkSuite(suite, this)
  }

  async runTest(): Promise<void> {
    throw new Error('`test()` and `it()` is only available in test mode.')
  }
}
