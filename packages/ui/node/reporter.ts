import { existsSync, promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, relative, resolve } from 'pathe'
import fg from 'fast-glob'
import { stringify } from 'flatted'
import { getOutputFile } from '../../vitest/src/utils/config-helpers'
import { getModuleGraph } from '../../vitest/src/utils'
import type { File, ModuleGraphData, Reporter, ResolvedConfig, Vitest } from '../../vitest/src/types'

interface HTMLReportData {
  paths: string[]
  files: File[]
  config: ResolvedConfig
  moduleGraph: Record<string, ModuleGraphData>
}

const distDir = resolve(fileURLToPath(import.meta.url), '../../dist')

export default class HTMLReporter implements Reporter {
  start = 0
  ctx!: Vitest
  reportUIPath!: string

  async onInit(ctx: Vitest) {
    this.ctx = ctx
    this.start = Date.now()
  }

  async onFinished() {
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
    const outputFile = getOutputFile(this.ctx.config, 'html') || 'html/html.meta.json'

    const reportFile = resolve(this.ctx.config.root, outputFile)

    const outputDirectory = dirname(reportFile)
    if (!existsSync(outputDirectory))
      await fs.mkdir(resolve(outputDirectory, 'assets'), { recursive: true })

    await fs.writeFile(reportFile, report, 'utf-8')
    const ui = resolve(distDir, 'report')
    // copy ui
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
