import type { Task, TestAttachment } from '@vitest/runner'
import type { ModuleGraphData, RunnerTestFile, SerializedConfig } from 'vitest'
import type { HTMLOptions, Vitest } from 'vitest/node'
import type { Reporter } from 'vitest/reporters'
import crypto from 'node:crypto'
import { promises as fs } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { gzip, constants as zlibConstants } from 'node:zlib'
import { stringify } from 'flatted'
import mime from 'mime/lite'
import { dirname, extname, relative, resolve } from 'pathe'
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

    await fs.mkdir(resolve(this.reporterDir, 'data'), { recursive: true })
    await fs.mkdir(resolve(this.reporterDir, 'assets'), { recursive: true })
  }

  async onFinished(): Promise<void> {
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

    const processAttachments = (task: Task) => {
      if (task.type === 'test') {
        task.annotations.forEach((annotation) => {
          const attachment = annotation.attachment
          if (attachment) {
            promises.push(this.processAttachment(attachment))
          }
        })
      }
      else {
        task.tasks.forEach(processAttachments)
      }
    }

    promises.push(...result.files.map(async (file) => {
      processAttachments(file)
      const projectName = file.projectName || ''
      const resolvedConfig = this.ctx.getProjectByName(projectName).config
      const browser = resolvedConfig.browser.enabled && resolvedConfig.browser.ui
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

  async processAttachment(attachment: TestAttachment): Promise<void> {
    if (attachment.path) {
      // keep external resource as is, but remove body if it's set somehow
      if (
        attachment.path.startsWith('http://')
        || attachment.path.startsWith('https://')
      ) {
        attachment.body = undefined
        return
      }

      const buffer = await readFile(attachment.path)
      const hash = crypto.createHash('sha1').update(buffer).digest('hex')
      const filename = hash + extname(attachment.path)
      // move the file into an html directory to make access/publishing UI easier
      await writeFile(resolve(this.reporterDir, 'data', filename), buffer)
      attachment.path = filename
      attachment.body = undefined
      return
    }

    if (attachment.body) {
      const buffer = typeof attachment.body === 'string'
        ? Buffer.from(attachment.body, 'base64')
        : Buffer.from(attachment.body)

      const hash = crypto.createHash('sha1').update(buffer).digest('hex')
      const extension = mime.getExtension(attachment.contentType || 'application/octet-stream') || 'dat'
      const filename = `${hash}.${extension}`
      // store the file in html directory instead of passing down as a body
      await writeFile(resolve(this.reporterDir, 'data', filename), buffer)
      attachment.path = filename
      attachment.body = undefined
    }
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
}
