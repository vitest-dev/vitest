import fs from 'node:fs'
import c from 'tinyrainbow'
import * as pathe from 'pathe'
import type { TaskResultPack } from '@vitest/runner'
import type { UserConsoleLog } from '../../../../types/general'
import { BaseReporter } from '../../base'
import type { BenchmarkResult, File } from '../../../../types'
import { getFullName, getTasks } from '../../../../utils'
import { getStateSymbol } from '../../renderers/utils'
import {
  type TableRendererOptions,
  createTableRenderer,
  renderTree,
} from './tableRender'

export class TableReporter extends BaseReporter {
  renderer?: ReturnType<typeof createTableRenderer>
  rendererOptions: TableRendererOptions = {} as any

  onTestRemoved(trigger?: string) {
    this.stopListRender()
    this.ctx.logger.clearScreen(
      c.yellow('Test removed...')
      + (trigger ? c.dim(` [ ${this.relative(trigger)} ]\n`) : ''),
      true,
    )
    const files = this.ctx.state.getFiles(this.watchFilters)
    createTableRenderer(files, this.rendererOptions).stop()
    this.ctx.logger.log()
    super.reportSummary(files, this.ctx.state.getUnhandledErrors())
    super.onWatcherStart()
  }

  async onCollected() {
    this.rendererOptions.logger = this.ctx.logger
    this.rendererOptions.showHeap = this.ctx.config.logHeapUsage
    this.rendererOptions.slowTestThreshold = this.ctx.config.slowTestThreshold
    if (this.ctx.config.benchmark?.compare) {
      const compareFile = pathe.resolve(
        this.ctx.config.root,
        this.ctx.config.benchmark?.compare,
      )
      try {
        this.rendererOptions.compare = flattenFormattedBenchmarkReport(
          JSON.parse(
            await fs.promises.readFile(compareFile, 'utf-8'),
          ),
        )
      }
      catch (e) {
        this.ctx.logger.error(`Failed to read '${compareFile}'`, e)
      }
    }
    if (this.isTTY) {
      const files = this.ctx.state.getFiles(this.watchFilters)
      if (!this.renderer) {
        this.renderer = createTableRenderer(
          files,
          this.rendererOptions,
        ).start()
      }
      else {
        this.renderer.update(files)
      }
    }
  }

  onTaskUpdate(packs: TaskResultPack[]) {
    if (this.isTTY) {
      return
    }
    for (const pack of packs) {
      const task = this.ctx.state.idMap.get(pack[0])
      if (
        task
        && task.type === 'suite'
        && task.result?.state
        && task.result?.state !== 'run'
      ) {
        // render static table when all benches inside single suite are finished
        const benches = task.tasks.filter(t => t.meta.benchmark)
        if (
          benches.length > 0
          && benches.every(t => t.result?.state !== 'run')
        ) {
          let title = ` ${getStateSymbol(task)} ${getFullName(
            task,
            c.dim(' > '),
          )}`
          if (
            task.result.duration != null
            && task.result.duration > this.ctx.config.slowTestThreshold
          ) {
            title += c.yellow(
              ` ${Math.round(task.result.duration)}${c.dim('ms')}`,
            )
          }
          this.ctx.logger.log(title)
          this.ctx.logger.log(
            renderTree(benches, this.rendererOptions, 1, true),
          )
        }
      }
    }
  }

  async onFinished(
    files = this.ctx.state.getFiles(),
    errors = this.ctx.state.getUnhandledErrors(),
  ) {
    this.stopListRender()
    this.ctx.logger.log()
    super.onFinished(files, errors)

    // write output for future comparison
    let outputFile = this.ctx.config.benchmark?.outputJson
    if (outputFile) {
      outputFile = pathe.resolve(this.ctx.config.root, outputFile)
      const outputDirectory = pathe.dirname(outputFile)
      if (!fs.existsSync(outputDirectory)) {
        await fs.promises.mkdir(outputDirectory, { recursive: true })
      }
      const output = createFormattedBenchmarkReport(files)
      await fs.promises.writeFile(outputFile, JSON.stringify(output, null, 2))
      this.ctx.logger.log(`Benchmark report written to ${outputFile}`)
    }
  }

  async onWatcherStart() {
    this.stopListRender()
    await super.onWatcherStart()
  }

  stopListRender() {
    this.renderer?.stop()
    this.renderer = undefined
  }

  async onWatcherRerun(files: string[], trigger?: string) {
    this.stopListRender()
    await super.onWatcherRerun(files, trigger)
  }

  onUserConsoleLog(log: UserConsoleLog) {
    if (!this.shouldLog(log)) {
      return
    }
    this.renderer?.clear()
    super.onUserConsoleLog(log)
  }
}

export interface FormattedBenchmarkReport {
  files: {
    filepath: string
    groups: FormattedBenchmarkGroup[]
  }[]
}

// flat results with TaskId as a key
export interface FlatBenchmarkReport {
  [id: string]: FormattedBenchmarkResult
}

interface FormattedBenchmarkGroup {
  fullName: string
  benchmarks: FormattedBenchmarkResult[]
}

export type FormattedBenchmarkResult = Omit<BenchmarkResult, 'samples'> & {
  id: string
  sampleCount: number
  median: number
}

function createFormattedBenchmarkReport(files: File[]) {
  const report: FormattedBenchmarkReport = { files: [] }
  for (const file of files) {
    const groups: FormattedBenchmarkGroup[] = []
    for (const task of getTasks(file)) {
      if (task && task.type === 'suite') {
        const benchmarks: FormattedBenchmarkResult[] = []
        for (const t of task.tasks) {
          const benchmark = t.meta.benchmark && t.result?.benchmark
          if (benchmark) {
            const { samples, ...rest } = benchmark
            benchmarks.push({
              id: t.id,
              sampleCount: samples.length,
              median:
                samples.length % 2
                  ? samples[Math.floor(samples.length / 2)]
                  : (samples[samples.length / 2]
                  + samples[samples.length / 2 - 1])
                  / 2,
              ...rest,
            })
          }
        }
        if (benchmarks.length) {
          groups.push({
            fullName: getFullName(task, ' > '),
            benchmarks,
          })
        }
      }
    }
    report.files.push({
      filepath: file.filepath,
      groups,
    })
  }
  return report
}

function flattenFormattedBenchmarkReport(report: FormattedBenchmarkReport): FlatBenchmarkReport {
  const flat: FlatBenchmarkReport = {}
  for (const file of report.files) {
    for (const group of file.groups) {
      for (const t of group.benchmarks) {
        flat[t.id] = t
      }
    }
  }
  return flat
}
