import type { Task, TaskResultPack } from '@vitest/runner'
import type { Vitest } from '../../core'
import fs from 'node:fs'
import { getFullName } from '@vitest/runner/utils'
import * as pathe from 'pathe'
import c from 'tinyrainbow'
import { DefaultReporter } from '../default'
import { formatProjectName, getStateSymbol } from '../renderers/utils'
import { createBenchmarkJsonReport, flattenFormattedBenchmarkReport } from './json-formatter'
import { renderTable } from './tableRender'

export class BenchmarkReporter extends DefaultReporter {
  compare?: Parameters<typeof renderTable>[0]['compare']

  async onInit(ctx: Vitest) {
    super.onInit(ctx)

    if (this.ctx.config.benchmark?.compare) {
      const compareFile = pathe.resolve(
        this.ctx.config.root,
        this.ctx.config.benchmark?.compare,
      )
      try {
        this.compare = flattenFormattedBenchmarkReport(
          JSON.parse(await fs.promises.readFile(compareFile, 'utf-8')),
        )
      }
      catch (e) {
        this.error(`Failed to read '${compareFile}'`, e)
      }
    }
  }

  onTaskUpdate(packs: TaskResultPack[]): void {
    for (const pack of packs) {
      const task = this.ctx.state.idMap.get(pack[0])

      if (task?.type === 'suite' && task.result?.state !== 'run') {
        task.tasks.filter(task => task.result?.benchmark)
          .sort((benchA, benchB) => benchA.result!.benchmark!.mean - benchB.result!.benchmark!.mean)
          .forEach((bench, idx) => {
            bench.result!.benchmark!.rank = Number(idx) + 1
          })
      }
    }

    super.onTaskUpdate(packs)
  }

  printTask(task: Task) {
    if (task?.type !== 'suite' || !task.result?.state || task.result?.state === 'run' || task.result?.state === 'queued') {
      return
    }

    const benches = task.tasks.filter(t => t.meta.benchmark)
    const duration = task.result.duration

    if (benches.length > 0 && benches.every(t => t.result?.state !== 'run' && t.result?.state !== 'queued')) {
      let title = `\n ${getStateSymbol(task)} ${formatProjectName(task.file.projectName)}${getFullName(task, c.dim(' > '))}`

      if (duration != null && duration > this.ctx.config.slowTestThreshold) {
        title += c.yellow(` ${Math.round(duration)}${c.dim('ms')}`)
      }

      this.log(title)
      this.log(renderTable({
        tasks: benches,
        level: 1,
        shallow: true,
        columns: this.ctx.logger.getColumns(),
        compare: this.compare,
        showHeap: this.ctx.config.logHeapUsage,
        slowTestThreshold: this.ctx.config.slowTestThreshold,
      }))
    }
  }

  async onFinished(files = this.ctx.state.getFiles(), errors = this.ctx.state.getUnhandledErrors()) {
    super.onFinished(files, errors)

    // write output for future comparison
    let outputFile = this.ctx.config.benchmark?.outputJson

    if (outputFile) {
      outputFile = pathe.resolve(this.ctx.config.root, outputFile)
      const outputDirectory = pathe.dirname(outputFile)

      if (!fs.existsSync(outputDirectory)) {
        await fs.promises.mkdir(outputDirectory, { recursive: true })
      }

      const output = createBenchmarkJsonReport(files)
      await fs.promises.writeFile(outputFile, JSON.stringify(output, null, 2))
      this.log(`Benchmark report written to ${outputFile}`)
    }
  }
}
