import fs from 'node:fs'
import c from 'picocolors'
import * as pathe from 'pathe'
import type { TaskResultPack } from '@vitest/runner'
import type { UserConsoleLog } from '../../../../types/general'
import { BaseReporter } from '../../base'
import type { BenchmarkResult, File } from '../../../../types'
import { getFullName, getTasks } from '../../../../utils'
import { getOutputFile } from '../../../../utils/config-helpers'
import { getStateSymbol } from '../../renderers/utils'
import { type TableRendererOptions, createTableRenderer, renderTree } from './tableRender'

export class TableReporter extends BaseReporter {
  renderer?: ReturnType<typeof createTableRenderer>
  rendererOptions: TableRendererOptions = {} as any

  async onTestRemoved(trigger?: string) {
    await this.stopListRender()
    this.ctx.logger.clearScreen(c.yellow('Test removed...') + (trigger ? c.dim(` [ ${this.relative(trigger)} ]\n`) : ''), true)
    const files = this.ctx.state.getFiles(this.watchFilters)
    createTableRenderer(files, this.rendererOptions).stop()
    this.ctx.logger.log()
    await super.reportSummary(files, this.ctx.state.getUnhandledErrors())
    super.onWatcherStart()
  }

  async onCollected() {
    if (this.isTTY) {
      this.rendererOptions.logger = this.ctx.logger
      this.rendererOptions.showHeap = this.ctx.config.logHeapUsage
      this.rendererOptions.slowTestThreshold = this.ctx.config.slowTestThreshold
      if (this.ctx.config.benchmark?.compare) {
        const compareFile = pathe.resolve(this.ctx.config.root, this.ctx.config.benchmark?.compare)
        try {
          this.rendererOptions.compare = JSON.parse(
            await fs.promises.readFile(compareFile, 'utf-8'),
          )
        }
        catch (e) {
          this.ctx.logger.error(`Failed to read '${compareFile}'`, e)
        }
      }
      const files = this.ctx.state.getFiles(this.watchFilters)
      if (!this.renderer)
        this.renderer = createTableRenderer(files, this.rendererOptions).start()
      else
        this.renderer.update(files)
    }
  }

  onTaskUpdate(packs: TaskResultPack[]) {
    if (this.isTTY)
      return
    for (const pack of packs) {
      const task = this.ctx.state.idMap.get(pack[0])
      if (task && task.type === 'suite' && task.result?.state && task.result?.state !== 'run') {
        // render static table when all benches inside single suite are finished
        const benches = task.tasks.filter(t => t.meta.benchmark)
        if (benches.length > 0 && benches.every(t => t.result?.state !== 'run')) {
          let title = ` ${getStateSymbol(task)} ${getFullName(task, c.dim(' > '))}`
          if (task.result.duration != null && task.result.duration > this.ctx.config.slowTestThreshold)
            title += c.yellow(` ${Math.round(task.result.duration)}${c.dim('ms')}`)
          this.ctx.logger.log(title)
          this.ctx.logger.log(renderTree(benches, this.rendererOptions, 1, true))
        }
      }
    }
  }

  async onFinished(files = this.ctx.state.getFiles(), errors = this.ctx.state.getUnhandledErrors()) {
    await this.stopListRender()
    this.ctx.logger.log()
    await super.onFinished(files, errors)

    // write output for future comparison
    let outputFile = getOutputFile(this.ctx.config.benchmark, 'default')
    if (outputFile) {
      outputFile = pathe.resolve(this.ctx.config.root, outputFile)
      const outputDirectory = pathe.dirname(outputFile)
      if (!fs.existsSync(outputDirectory))
        await fs.promises.mkdir(outputDirectory, { recursive: true })
      const output = createBenchmarkOutput(files)
      await fs.promises.writeFile(outputFile, JSON.stringify(output, null, 2))
    }
  }

  async onWatcherStart() {
    await this.stopListRender()
    await super.onWatcherStart()
  }

  async stopListRender() {
    await this.renderer?.stop()
    this.renderer = undefined
  }

  async onWatcherRerun(files: string[], trigger?: string) {
    await this.stopListRender()
    await super.onWatcherRerun(files, trigger)
  }

  onUserConsoleLog(log: UserConsoleLog) {
    if (!this.shouldLog(log))
      return
    this.renderer?.clear()
    super.onUserConsoleLog(log)
  }
}

export interface TableBenchmarkOutput {
  [id: string]: Omit<BenchmarkResult, 'samples'>
}

function createBenchmarkOutput(files: File[]) {
  const result: TableBenchmarkOutput = {}
  for (const test of getTasks(files)) {
    if (test.meta?.benchmark && test.result?.benchmark) {
      // strip gigantic "samples"
      const { samples: _samples, ...rest } = test.result.benchmark
      result[test.id] = rest
    }
  }
  return result
}
