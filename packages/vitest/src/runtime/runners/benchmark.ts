import type {
  Suite,
  Task,
  VitestRunner,
  VitestRunnerImportSource,
} from '@vitest/runner'
import type { SerializedConfig } from '../config'
import type { VitestExecutor } from '../execute'
import type {
  Benchmark,
  BenchmarkResult,
  TinybenchTask,
} from '../types/benchmark'
import { updateTask as updateRunnerTask } from '@vitest/runner'
import { createDefer, getSafeTimers } from '@vitest/utils'
import { getBenchFn, getBenchOptions } from '../benchmark'
import { getWorkerState } from '../utils'

function createBenchmarkResult(name: string): BenchmarkResult {
  return {
    name,
    rank: 0,
    numberOfSamples: 0,
  } as BenchmarkResult
}

async function runBenchmarkSuite(suite: Suite, runner: NodeBenchmarkRunner) {
  const start = performance.now()

  const benchmarkGroup: Benchmark[] = []
  const benchmarkSuiteGroup: Suite[] = []
  for (const task of suite.tasks) {
    if (task.mode !== 'run' && task.mode !== 'queued') {
      continue
    }

    if (task.meta?.benchmark) {
      benchmarkGroup.push(task as Benchmark)
    }
    else if (task.type === 'suite') {
      benchmarkSuiteGroup.push(task)
    }
  }

  if (benchmarkSuiteGroup.length) {
    for (const subSuite of benchmarkSuiteGroup) {
      await runBenchmarkSuite(subSuite, runner)
    }
  }

  if (benchmarkGroup.length) {
    const { Bench } = await runner.importTinybench()

    const defer = createDefer()
    suite.result = {
      state: 'run',
      startTime: start,
      benchmark: createBenchmarkResult(suite.name),
    }
    updateTask(suite)

    const addBenchTaskListener = (
      task: InstanceType<typeof TinybenchTask>,
      benchmark: Benchmark,
    ) => {
      task.addEventListener('start', () => {
        benchmark.result!.state = 'run'
        updateTask(benchmark)
      })
      task.addEventListener(
        'complete',
        (e) => {
          const task = e.task
          benchmark.result!.state = 'pass'
          const result = benchmark.result!.benchmark!
          Object.assign(result, task!.result!)
          result.numberOfSamples = result.latency.samples.length
          if (!runner.config.benchmark?.includeSamples) {
            result.samples.length = 0
            result.latency.samples.length = 0
            result.throughput.samples.length = 0
          }
          updateTask(benchmark)
        },
        {
          once: true,
        },
      )
      task.addEventListener(
        'error',
        (e) => {
          benchmark.result!.state = 'fail'
          updateTask(benchmark)
          defer.reject(e.error)
        },
        {
          once: true,
        },
      )
    }

    const { setTimeout } = getSafeTimers()
    const tasks: [TinybenchTask, Benchmark][] = []
    for (const benchmark of benchmarkGroup) {
      const bench = new Bench(getBenchOptions(benchmark))
      bench.add(benchmark.name, getBenchFn(benchmark))
      benchmark.result = {
        state: 'run',
        startTime: start,
        benchmark: createBenchmarkResult(benchmark.name),
      }
      addBenchTaskListener(bench.getTask(benchmark.name)!, benchmark)
      updateTask(benchmark)
      tasks.push([await new Promise<TinybenchTask>(resolve =>
        setTimeout(async () => {
          resolve((await bench.run())[0])
        }),
      ), benchmark])
    }

    suite.result!.duration = performance.now() - start
    suite.result!.state = benchmarkGroup.every(benchmark => benchmark.result!.state === 'pass') ? 'pass' : 'fail'

    tasks
      .sort(([taskA], [taskB]) => taskA.result!.latency.mean - taskB.result!.latency.mean)
      .forEach(([, benchmark], idx) => {
        benchmark.result!.state = 'pass'
        if (benchmark) {
          const result = benchmark.result!.benchmark!
          result.rank = idx + 1
          updateTask(benchmark)
        }
      })
    updateTask(suite)
    defer.resolve(null)

    await defer
  }

  function updateTask(task: Task) {
    updateRunnerTask(task, runner)
  }
}

export class NodeBenchmarkRunner implements VitestRunner {
  private __vitest_executor!: VitestExecutor

  constructor(public config: SerializedConfig) {}

  async importTinybench() {
    return await import('tinybench')
  }

  importFile(filepath: string, source: VitestRunnerImportSource): unknown {
    if (source === 'setup') {
      getWorkerState().moduleCache.delete(filepath)
    }
    return this.__vitest_executor.executeId(filepath)
  }

  async runSuite(suite: Suite): Promise<void> {
    await runBenchmarkSuite(suite, this)
  }

  async runTask(): Promise<void> {
    throw new Error('`test()` and `it()` is only available in test mode.')
  }
}
