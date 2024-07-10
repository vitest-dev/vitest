import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { gzip, constants as zlibConstants } from 'node:zlib'
import { basename, dirname, relative, resolve } from 'pathe'
import c from 'tinyrainbow'
import fg from 'fast-glob'
import { stringify } from 'flatted'
import type {
  File,
  ModuleGraphData,
  Reporter,
  ResolvedConfig,
  Vitest,
} from 'vitest'
import type { HTMLOptions } from 'vitest/node'
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
  files: File[]
  config: ResolvedConfig
  moduleGraph: Record<string, Record<string, ModuleGraphData>>
  unhandledErrors: unknown[]
  // filename -> source
  sources: Record<string, string>
}

const distDir = resolve(fileURLToPath(import.meta.url), '../../dist')

export default class HTMLReporter implements Reporter {
  start = 0
  ctx!: Vitest
  reportUIPath!: string
  options: HTMLOptions

  constructor(options: HTMLOptions) {
    this.options = options
  }

  async onInit(ctx: Vitest) {
    this.ctx = ctx
    this.start = Date.now()
  }

  async onFinished() {
    const result: HTMLReportData = {
      paths: this.ctx.state.getPaths(),
      files: this.ctx.state.getFiles(),
      config: this.ctx.config,
      unhandledErrors: this.ctx.state.getUnhandledErrors(),
      moduleGraph: {},
      sources: {},
    }
    await Promise.all(
      result.files.map(async (file) => {
        const projectName = file.projectName || ''
        result.moduleGraph[projectName] ??= {}
        result.moduleGraph[projectName][file.filepath] = await getModuleGraph(
          this.ctx as any,
          projectName,
          file.filepath,
        )
        if (!result.sources[file.filepath]) {
          try {
            result.sources[file.filepath] = await fs.readFile(file.filepath, {
              encoding: 'utf-8',
            })
          }
          catch (_) {
            // just ignore
          }
        }
      }),
    )
    await this.writeReport(stringify(result))
  }

  async writeReport(report: string) {
    const htmlFile
      = this.options.outputFile
      || getOutputFile(this.ctx.config)
      || 'html/index.html'
    const htmlFileName = basename(htmlFile)
    const htmlDir = resolve(this.ctx.config.root, dirname(htmlFile))

    const metaFile = resolve(htmlDir, 'html.meta.json.gz')

    await fs.mkdir(resolve(htmlDir, 'assets'), { recursive: true })

    const promiseGzip = promisify(gzip)
    const data = await promiseGzip(report, {
      level: zlibConstants.Z_BEST_COMPRESSION,
    })
    await fs.writeFile(metaFile, data, 'base64')
    const ui = resolve(distDir, 'client')
    // copy ui
    const files = fg.sync('**/*', { cwd: ui })
    await Promise.all(
      files.map(async (f) => {
        if (f === 'index.html') {
          const html = await fs.readFile(resolve(ui, f), 'utf-8')
          const filePath = relative(htmlDir, metaFile)
          await fs.writeFile(
            resolve(htmlDir, htmlFileName),
            html.replace(
              '<!-- !LOAD_METADATA! -->',
              `<script>window.METADATA_PATH="${filePath}"</script>`,
            ),
          )
        }
        else {
          await fs.copyFile(resolve(ui, f), resolve(htmlDir, f))
        }
      }),
    )

    this.ctx.logger.log(
      `${c.bold(c.inverse(c.magenta(' HTML ')))} ${c.magenta(
        'Report is generated',
      )}`,
    )
    this.ctx.logger.log(
      `${c.dim('       You can run ')}${c.bold(
        `npx vite preview --outDir ${relative(this.ctx.config.root, htmlDir)}`,
      )}${c.dim(' to see the test results.')}`,
    )
  }
}
