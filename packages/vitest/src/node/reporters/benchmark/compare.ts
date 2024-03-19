import fs from 'node:fs'
import path from 'node:path'
import type { BenchmarkResult, File, Reporter, Task, Vitest } from '../../../types'

/*

VITEST_BENCH_OUTPUT_FILE=main.json pnpm -C examples/basic test bench -- --run --reporter default --reporter wip
VITEST_BENCH_COMPARE=main.json pnpm -C examples/basic test bench -- --reporter default --reporter wip

*/

interface BenchEntries { [id: string]: Omit<BenchmarkResult, 'samples'> }

function traverseTask(
  task: Task,
  callback: (task: Task, depth: number) => void,
  depth = 0,
) {
  if (task.type === 'suite') {
    callback(task, depth)
    for (const t of task.tasks)
      traverseTask(t, callback, depth + 1)
  }
  else {
    callback(task, depth)
  }
}

export class CompareReporter implements Reporter {
  ctx: Vitest = undefined!

  onInit(ctx: Vitest) {
    this.ctx = ctx
  }

  async onFinished(files: File[] = []) {
    // TODO: use env var as flag for prototype
    // --benchmark.outputFile
    const newFile = process.env.VITEST_BENCH_OUTPUT_FILE
    // --compare
    const baseFile = process.env.VITEST_BENCH_COMPARE

    let baseEntries: BenchEntries | undefined
    if (baseFile) {
      if (fs.existsSync(baseFile))
        baseEntries = JSON.parse(await fs.promises.readFile(baseFile, 'utf-8'))
      else
        this.ctx.logger.log('baseline not found:', baseFile)
    }

    if (!newFile && !baseFile) {
      this.ctx.logger.log('Use --benchmark.outputFile to save current run ')
      return
    }

    if (baseFile) {
      this.ctx.logger.log('')
      this.ctx.logger.log('[BENCH] baseline:', path.resolve(baseFile))
      this.ctx.logger.log('')
    }

    const currentEntries: BenchEntries = {}
    for (const file of files) {
      traverseTask(file, (t, depth) => {
        if (t.type === 'suite') {
          this.ctx.logger.log(' '.repeat(depth * 2), t.name)
          return
        }
        if (t.result?.benchmark) {
          const { samples: _samples, ...current } = t.result.benchmark
          currentEntries[t.id] = current

          const baseline = baseEntries?.[t.id]
          if (baseline) {
            const diff = current.hz / baseline.hz
            this.ctx.logger.log(
              ' '.repeat(depth * 2),
              t.name,
              `${current.hz.toPrecision(5)}hz`,
              `[baseline: ${baseline.hz.toPrecision(5)}hz]`,
              `[change: ${diff.toFixed(2)}x ${diff > 1 ? '⇑' : '⇓'}]`,
            )
          }
          else {
            this.ctx.logger.log(
              ' '.repeat(depth * 2),
              `${current.hz.toPrecision(5)}hz`,
              `(no baseline)`,
            )
          }
        }
      })
    }

    if (newFile) {
      if (!fs.existsSync(path.dirname(newFile)))
        await fs.promises.mkdir(path.dirname(newFile), { recursive: true })
      await fs.promises.writeFile(newFile, JSON.stringify(currentEntries, null, 2))
    }
  }
}
