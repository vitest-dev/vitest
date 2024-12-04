import type { Task } from '@vitest/runner'
import type { Vitest } from '../../core'
import fs from 'node:fs'
import { getFullName } from '@vitest/runner/utils'
import * as pathe from 'pathe'
import c from 'tinyrainbow'
import { DefaultReporter } from '../default'
import { getStateSymbol } from '../renderers/utils'
import { createBenchmarkJsonReport, flattenFormattedBenchmarkReport } from './json-formatter'
import { renderTable } from './tableRender'

export class BenchmarkReporter extends DefaultReporter {
  protected verbose = true
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

  printTask(task: Task) {
    if (task?.type !== 'suite' || !task.result?.state || task.result?.state === 'run') {
      return
    }

    const benches = task.tasks.filter(t => t.meta.benchmark)
    const duration = task.result.duration

    if (benches.length > 0 && benches.every(t => t.result?.state !== 'run')) {
      let title = ` ${getStateSymbol(task)} ${getFullName(task, c.dim(' > '))}`

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
