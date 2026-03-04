import type { ModuleGraphData, RunnerTestFile, SerializedConfig } from 'vitest'
import type { HTMLOptions, Reporter, Vitest } from 'vitest/node'
import { existsSync, promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { gzip, constants as zlibConstants } from 'node:zlib'
import { stringify } from 'flatted'
import { dirname, relative, resolve } from 'pathe'
import { globSync } from 'tinyglobby'
import c from 'tinyrainbow'
import { getModuleGraph } from '../../vitest/src/utils/graph'

interface PotentialConfig {
  outputFile?: string | Partial<Record<string, string>>
}

function getOutputFile(config: PotentialConfig | undefined) {
  if (!config?.outputFile) {
    return
  }

  if (typeof config.outputFile === 'string') {
    return config.outputFile
  }

  return config.outputFile.html
}

interface HTMLReportData {
  paths: string[]
  files: RunnerTestFile[]
  config: SerializedConfig
  projects: string[]
  moduleGraph: Record<string, Record<string, ModuleGraphData>>
  unhandledErrors: unknown[]
  // filename -> source
  sources: Record<string, string>
}

const distDir = resolve(fileURLToPath(import.meta.url), '../../dist')

export default class HTMLReporter implements Reporter {
  start = 0
  ctx!: Vitest
  options: HTMLOptions

  private reporterDir!: string
  private htmlFilePath!: string

  constructor(options: HTMLOptions) {
    this.options = options
  }

  async onInit(ctx: Vitest): Promise<void> {
    this.ctx = ctx
    this.start = Date.now()
    const htmlFile
      = this.options.outputFile
        || getOutputFile(this.ctx.config)
        || 'html/index.html'
    const htmlFilePath = resolve(this.ctx.config.root, htmlFile)
    this.reporterDir = dirname(htmlFilePath)
    this.htmlFilePath = htmlFilePath

    await fs.mkdir(resolve(this.reporterDir, 'assets'), { recursive: true })
  }

  async onTestRunEnd(): Promise<void> {
    const result: HTMLReportData = {
      paths: this.ctx.state.getPaths(),
      files: this.ctx.state.getFiles(),
      config: this.ctx.getRootProject().serializedConfig,
      unhandledErrors: this.ctx.state.getUnhandledErrors(),
      projects: this.ctx.projects.map(p => p.name),
      moduleGraph: {},
      sources: {},
    }
    const promises: Promise<void>[] = []

    promises.push(...result.files.map(async (file) => {
      const projectName = file.projectName || ''
      const resolvedConfig = this.ctx.getProjectByName(projectName).config
      const browser = resolvedConfig.browser.enabled
      result.moduleGraph[projectName] ??= {}
      result.moduleGraph[projectName][file.filepath] = await getModuleGraph(
        this.ctx,
        projectName,
        file.filepath,
        browser,
      )
      if (!result.sources[file.filepath]) {
        try {
          result.sources[file.filepath] = await fs.readFile(file.filepath, {
            encoding: 'utf-8',
          })
        }
        catch {
          // just ignore
        }
      }
    }))

    await Promise.all(promises)
    await this.writeReport(stringify(result))
  }

  async writeReport(report: string): Promise<void> {
    const metaFile = resolve(this.reporterDir, 'html.meta.json.gz')

    const promiseGzip = promisify(gzip)
    const data = await promiseGzip(report, {
      level: zlibConstants.Z_BEST_COMPRESSION,
    })
    await fs.writeFile(metaFile, data, 'base64')
    const ui = resolve(distDir, 'client')
    // copy ui
    const files = globSync(['**/*'], { cwd: ui, expandDirectories: false })
    await Promise.all(
      files.map(async (f) => {
        if (f === 'index.html') {
          const html = await fs.readFile(resolve(ui, f), 'utf-8')
          const filePath = relative(this.reporterDir, metaFile)
          await fs.writeFile(
            this.htmlFilePath,
            html.replace(
              '<!-- !LOAD_METADATA! -->',
              `<script>window.METADATA_PATH="${filePath}"</script>`,
            ),
          )
        }
        else {
          await fs.copyFile(resolve(ui, f), resolve(this.reporterDir, f))
        }
      }),
    )

    // copy attachments
    // TODO: unify attachmentsDir and html outputFile, so both live together without extra copy
    if (existsSync(this.ctx.config.attachmentsDir)) {
      const destAttachmentsDir = resolve(this.reporterDir, 'data')
      await fs.rm(destAttachmentsDir, { recursive: true, force: true })
      await fs.mkdir(destAttachmentsDir, { recursive: true })
      await fs.cp(this.ctx.config.attachmentsDir, destAttachmentsDir, { recursive: true })
    }

    this.ctx.logger.log(
      `${c.bold(c.inverse(c.magenta(' HTML ')))} ${c.magenta(
        'Report is generated',
      )}`,
    )
    this.ctx.logger.log(
      `${c.dim('       You can run ')}${c.bold(
        `npx vite preview --outDir ${relative(this.ctx.config.root, this.reporterDir)}`,
      )}${c.dim(' to see the test results.')}`,
    )
  }

  async onFinishedReportCoverage(): Promise<void> {
    if (this.ctx.config.coverage.enabled && this.ctx.config.coverage.htmlDir) {
      const coverageHtmlDir = this.ctx.config.coverage.htmlDir
      const destCoverageDir = resolve(this.reporterDir, 'coverage')
      await fs.rm(destCoverageDir, { recursive: true, force: true })
      await fs.mkdir(destCoverageDir, { recursive: true })
      await fs.cp(coverageHtmlDir, destCoverageDir, { recursive: true })
    }
  }
}
