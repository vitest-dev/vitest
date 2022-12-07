import { existsSync, promises as fs } from 'fs'
import { dirname, relative, resolve } from 'pathe'
import fg from 'fast-glob'
import { stringify } from 'flatted'
import { distDir } from '../../constants'
import type { Vitest } from '../../node'
import type { File, Reporter } from '../../types'
import { getOutputFile } from '../../utils/config-helpers'
import { getModuleGraph } from '../../api/setup'
import type { ResolvedConfig } from './../../types/config'
import type { ModuleGraphData } from './../../types/general'

interface HTMLReportData {
  paths: string[]
  files: File[]
  config: ResolvedConfig
  moduleGraph: Record<string, ModuleGraphData>
}

export class HTMLReporter implements Reporter {
  start = 0
  ctx!: Vitest

  onInit(ctx: Vitest): void {
    this.ctx = ctx
    this.start = Date.now()
  }

  async onFinally() {
    const result: HTMLReportData = {
      paths: await this.ctx.state.getPaths(),
      files: this.ctx.state.getFiles(),
      config: this.ctx.config,
      moduleGraph: {},
    }
    await Promise.all(
      result.files.map(async (file) => {
        result.moduleGraph[file.filepath] = await getModuleGraph(this.ctx, file.filepath)
      }),
    )
    await this.writeReport(stringify(result))
  }

  /**
   * Writes the report to an output file
   * @param report
   */
  async writeReport(report: string) {
    const outputFile = getOutputFile(this.ctx.config, 'json') || 'html/html.meta.json'

    const reportFile = resolve(this.ctx.config.root, outputFile)

    const outputDirectory = dirname(reportFile)
    if (!existsSync(outputDirectory))
      await fs.mkdir(resolve(outputDirectory, 'assets'), { recursive: true })

    await fs.writeFile(reportFile, report, 'utf-8')

    // copy ui
    const ui = resolve(distDir, 'html-report')
    const files = fg.sync('**/*', { cwd: ui })
    await Promise.all(files.map(async (f) => {
      if (f === 'index.html') {
        const html = await fs.readFile(resolve(ui, f), 'utf-8')
        const filePath = relative(outputDirectory, reportFile)
        await fs.writeFile(
          resolve(outputDirectory, f),
          html.replace('<!-- !LOAD_METADATA! -->', `<script>window.METADATA_PATH="${filePath}"</script>`),
        )
      }
      else {
        await fs.copyFile(resolve(ui, f), resolve(outputDirectory, f))
      }
    }))

    this.ctx.logger.log(`HTML report written to ${reportFile}`)
  }
}
