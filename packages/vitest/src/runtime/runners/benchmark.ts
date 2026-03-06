import type {
  Suite,
  Task,
  TaskUpdateEvent,
  VitestRunner,
  VitestRunnerImportSource,
} from '@vitest/runner'
import type { ModuleRunner } from 'vite/module-runner'
import type { SerializedConfig } from '../config'
import type {
  Benchmark,
  BenchmarkResult,
  BenchmarkStatistics,
  TinybenchTask,
} from '../types/benchmark'
import { updateTask as updateRunnerTask } from '@vitest/runner'
import { createDefer } from '@vitest/utils/helpers'
import { getSafeTimers } from '@vitest/utils/timers'
import { getBenchFn, getBenchOptions } from '../benchmark'
import { getWorkerState } from '../utils'

function createEmptyStatistics(): BenchmarkStatistics {
  return {
    aad: 0,
    critical: 0,
    df: 0,
    mad: 0,
    max: 0,
    mean: 0,
    min: 0,
    moe: 0,
    p50: 0,
    p75: 0,
    p99: 0,
    p995: 0,
    p999: 0,
    rme: 0,
    samples: undefined,
    samplesCount: 0,
    sd: 0,
    sem: 0,
    variance: 0,
  }
}

function createBenchmarkResult(name: string): BenchmarkResult {
  return {
    name,
    rank: 0,
    samplesCount: 0,
    latency: createEmptyStatistics(),
    throughput: createEmptyStatistics(),
    period: 0,
    totalTime: 0,
  }
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
    updateTask('suite-prepare', suite)

    const addBenchTaskListener = (
      task: TinybenchTask,
      benchmark: Benchmark,
    ) => {
      let hasErrored = false

      task.addEventListener(
        'error',
        (e) => {
          hasErrored = true
          defer.reject(e.error ?? e)
        },
        {
          once: true,
        },
      )
      task.addEventListener(
        'complete',
        (e) => {
          const task = e.task!
          const taskResult = task.result

          if (hasErrored || taskResult.state !== 'completed') {
            benchmark.result!.state = 'fail'
            updateTask('test-finished', benchmark)
            return
          }

          const result = benchmark.result!.benchmark!
          result.latency = {
            ...taskResult.latency,
            samples: taskResult.latency.samples
              ? [...taskResult.latency.samples]
              : undefined,
          }
          result.throughput = {
            ...taskResult.throughput,
            samples: taskResult.throughput.samples
              ? [...taskResult.throughput.samples]
              : undefined,
          }
          result.period = taskResult.period
          result.totalTime = taskResult.totalTime
          result.samplesCount = taskResult.latency.samplesCount
          benchmark.result!.state = 'pass'
          updateTask('test-finished', benchmark)
        },
        {
          once: true,
        },
      )
    }

    const { setTimeout } = getSafeTimers()
    for (const benchmark of benchmarkGroup) {
      const benchOptions = getBenchOptions(benchmark, runner.config)
      const bench = new Bench(benchOptions)
      bench.add(benchmark.name, getBenchFn(benchmark))
      benchmark.result = {
        state: 'run',
        startTime: start,
        benchmark: createBenchmarkResult(benchmark.name),
      }
      addBenchTaskListener(bench.getTask(benchmark.name)!, benchmark)
      updateTask('test-prepare', benchmark)
      await new Promise<void>(resolve =>
        setTimeout(async () => {
          await bench.run()
          resolve()
        }),
      )
    }

    suite.result!.duration = performance.now() - start
    suite.result!.state = 'pass'

    updateTask('suite-finished', suite)
    defer.resolve(null)

    await defer
  }

  function updateTask(event: TaskUpdateEvent, task: Task) {
    updateRunnerTask(event, task, runner)
  }
}

export class NodeBenchmarkRunner implements VitestRunner {
  private moduleRunner!: ModuleRunner

  constructor(public config: SerializedConfig) {}

  async importTinybench(): Promise<typeof import('tinybench')> {
    return await import('tinybench')
  }

  importFile(filepath: string, source: VitestRunnerImportSource): unknown {
    if (source === 'setup') {
      const moduleNode = getWorkerState().evaluatedModules.getModuleById(filepath)
      if (moduleNode) {
        getWorkerState().evaluatedModules.invalidateModule(moduleNode)
      }
    }
    return this.moduleRunner.import(filepath)
  }

  async runSuite(suite: Suite): Promise<void> {
    await runBenchmarkSuite(suite, this)
  }

  async runTask(): Promise<void> {
    throw new Error('`test()` and `it()` is only available in test mode.')
  }
}
