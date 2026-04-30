import type { HTMLOptions, Reporter, Vitest } from 'vitest/node'
import type { HTMLReportMetadata } from '../client/composables/client/static'
import { existsSync, promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { gzip, constants as zlibConstants } from 'node:zlib'
import { stringify } from 'flatted'
import { dirname, relative, resolve } from 'pathe'
import { globSync } from 'tinyglobby'
import c from 'tinyrainbow'
import { getModuleGraph } from '../../vitest/src/utils/graph'
import { createHash } from 'node:crypto'

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
    const result: HTMLReportMetadata = {
      paths: this.ctx.state.getPaths(),
      files: this.ctx.state.getFiles(),
      config: this.ctx.serializedRootConfig,
      unhandledErrors: this.ctx.state.getUnhandledErrors(),
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
    const promiseGzip = promisify(gzip)
    const data = await promiseGzip(report, {
      level: zlibConstants.Z_BEST_COMPRESSION,
    })
    const ui = resolve(distDir, 'client')
    // copy ui
    const files = globSync(['**/*'], { cwd: ui, expandDirectories: false })
    await Promise.all(
      files.map(async (f) => {
        if (f === 'index.html') {
          const html = await fs.readFile(resolve(ui, f), 'utf-8')
          let metadataCode: string;
          if (this.options.singleFile ?? true) {
            const base64 = Buffer.from(data).toString("base64")
            metadataCode = `Promise.resolve((${decodeBase64.toString()})("${base64}"))`
          } else {
            const hash = createHash('sha256').update(data).digest('hex').slice(0, 6)
            const dataFile = `metadata-${hash}.bin.gz`
            await fs.writeFile(resolve(this.reporterDir, dataFile), data, 'base64')
            metadataCode = `fetch(new URL("./${dataFile}", window.location.href)).then(async res => new Uint8Array(await res.arrayBuffer()))`
          }
          await fs.writeFile(
            this.htmlFilePath,
            html.replace(
              '<!-- !LOAD_METADATA! -->',
              `<script>window.HTML_REPORT_METADATA = ${metadataCode}</script>`,
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
      if (coverageHtmlDir === destCoverageDir) {
        // skip and preserve already generated coverage report.
        // this can happen when users configures `outputFile`
        // next to `coverage.reportsDirectory`.
        return
      }
      await fs.rm(destCoverageDir, { recursive: true, force: true })
      await fs.mkdir(destCoverageDir, { recursive: true })
      await fs.cp(coverageHtmlDir, destCoverageDir, { recursive: true })
    }
  }
}

function decodeBase64(base64: string): Uint8Array {
  function stringToUint8Array(binary: string): Uint8Array {
    const len = binary.length
    const arr = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      arr[i] = binary.charCodeAt(i)
    }
    return arr
  }
  return stringToUint8Array(atob(base64))
}
