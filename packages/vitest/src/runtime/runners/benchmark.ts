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
  BenchTask,
} from '../types/benchmark'
import { updateTask as updateRunnerTask } from '@vitest/runner'
import { createDefer, getSafeTimers } from '@vitest/utils'
import { getBenchFn, getBenchOptions } from '../benchmark'
import { getWorkerState } from '../utils'

function createBenchmarkResult(name: string): BenchmarkResult {
  return {
    name,
    rank: 0,
    rme: 0,
    samples: [] as number[],
  } as BenchmarkResult
}

const benchmarkTasks = new WeakMap<Benchmark, import('tinybench').Task>()

async function runBenchmarkSuite(suite: Suite, runner: NodeBenchmarkRunner) {
  const { Task, Bench } = await runner.importTinybench()

  const start = performance.now()

  const benchmarkGroup: Benchmark[] = []
  const benchmarkSuiteGroup = []
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

  // run sub suites sequentially
  for (const subSuite of benchmarkSuiteGroup) {
    await runBenchmarkSuite(subSuite, runner)
  }

  if (benchmarkGroup.length) {
    const defer = createDefer()
    suite.result = {
      state: 'run',
      startTime: start,
      benchmark: createBenchmarkResult(suite.name),
    }
    updateTask(suite)

    const addBenchTaskListener = (
      task: InstanceType<typeof Task>,
      benchmark: Benchmark,
    ) => {
      task.addEventListener(
        'complete',
        (e) => {
          const task = e.task
          const taskRes = task.result!
          const result = benchmark.result!.benchmark!
          benchmark.result!.state = 'pass'
          Object.assign(result, taskRes)
          // compute extra stats and free raw samples as early as possible
          const samples = result.samples
          result.sampleCount = samples.length
          result.median = samples.length % 2
            ? samples[Math.floor(samples.length / 2)]
            : (samples[samples.length / 2] + samples[samples.length / 2 - 1]) / 2
          if (!runner.config.benchmark?.includeSamples) {
            result.samples.length = 0
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
          const task = e.task
          defer.reject(benchmark ? task.result!.error : e)
        },
        {
          once: true,
        },
      )
    }

    benchmarkGroup.forEach((benchmark) => {
      const options = getBenchOptions(benchmark)
      const benchmarkInstance = new Bench(options)

      const benchmarkFn = getBenchFn(benchmark)

      benchmark.result = {
        state: 'run',
        startTime: start,
        benchmark: createBenchmarkResult(benchmark.name),
      }

      const task = new Task(benchmarkInstance, benchmark.name, benchmarkFn)
      benchmarkTasks.set(benchmark, task)
      addBenchTaskListener(task, benchmark)
    })

    const { setTimeout } = getSafeTimers()
    const tasks: [BenchTask, Benchmark][] = []

    for (const benchmark of benchmarkGroup) {
      const task = benchmarkTasks.get(benchmark)!
      updateTask(benchmark)
      await task.warmup()
      tasks.push([
        await new Promise<BenchTask>(resolve =>
          setTimeout(async () => {
            resolve(await task.run())
          }),
        ),
        benchmark,
      ])
    }

    suite.result!.duration = performance.now() - start
    suite.result!.state = 'pass'

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

  async importFile(filepath: string, source: VitestRunnerImportSource): Promise<unknown> {
    if (source === 'setup') {
      const resolved = await this.__vitest_executor.resolveUrl(filepath)
      getWorkerState().moduleCache.delete(resolved[1])
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
