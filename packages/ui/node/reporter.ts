import type { HTMLOptions, Reporter, RunnerTask, RunnerTestFile, Vitest } from 'vitest/node'
import type { HTMLReportMetadata } from '../client/composables/client/static'
import { existsSync, promises as fs, readFileSync } from 'node:fs'
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

    if (this.options.singleFile) {
      await inlineAttachments(result.files)
    }

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
          const htmlFilePath = resolve(ui, f)
          let html = await fs.readFile(htmlFilePath, 'utf-8')
          let metadataCode: string
          if (this.options.singleFile) {
            html = await inlineHtmlAssets(htmlFilePath, html)
            // singleFile uses gzip+base64 so the embedded report stays an ASCII-safe
            // representation of the same gzipped metadata bytes used by the external-file path.
            // - Raw JSON: simpler to inspect and can be smaller when the whole HTML is served with HTTP gzip/brotli, but needs careful script/HTML escaping and makes the browser scan more inline HTML before startup.
            // - Gzip + base64: robust for arbitrary compressed bytes, keeps standalone artifacts smaller, and defers decode/gunzip/JSON parse behind HTML_REPORT_METADATA.
            const base64 = Buffer.from(data).toString('base64')
            metadataCode = `Promise.resolve((${uint8ArrayFromBase64.toString()})("${base64}"))`
          }
          else {
            // TODO: should we add content hash?
            const dataFile = `html.meta.json.gz`
            await fs.writeFile(resolve(this.reporterDir, dataFile), data, 'base64')
            metadataCode = `fetch(new URL("./${dataFile}", window.location.href)).then(async res => new Uint8Array(await res.arrayBuffer()))`
          }
          await fs.writeFile(
            this.htmlFilePath,
            html.replace(
              '<!-- !LOAD_METADATA! -->',
              `<script>window.HTML_REPORT_METADATA=${metadataCode}</script>`,
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
    if (!this.options.singleFile && existsSync(this.ctx.config.attachmentsDir)) {
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

async function inlineAttachments(files: RunnerTestFile[]): Promise<void> {
  for (const file of files) {
    await inlineTaskAttachments(file)
  }
}

async function inlineTaskAttachments(task: RunnerTask): Promise<void> {
  if ('tasks' in task) {
    for (const child of task.tasks) {
      await inlineTaskAttachments(child)
    }
  }
  if ('annotations' in task) {
    for (const annotation of task.annotations) {
      const attachment = annotation.attachment
      if (attachment?.path && !isExternalAttachmentPath(attachment.path)) {
        try {
          const buffer = await fs.readFile(attachment.path)
          attachment.body = buffer.toString('base64')
          attachment.bodyEncoding = 'base64'
          attachment.path = undefined
        }
        catch {
          // Keep the path so report generation does not fail when an attachment
          // cannot be embedded.
        }
      }
    }
  }
  if ('artifacts' in task) {
    for (const artifact of task.artifacts) {
      for (const attachment of artifact.attachments ?? []) {
        if (attachment.path && !isExternalAttachmentPath(attachment.path)) {
          try {
            const buffer = await fs.readFile(attachment.path)
            attachment.body = buffer.toString('base64')
            attachment.bodyEncoding = 'base64'
            attachment.path = undefined
          }
          catch {
            // Keep the path so report generation does not fail when an attachment
            // cannot be embedded.
          }
        }
      }
    }
  }
}

function isExternalAttachmentPath(path: string): boolean {
  return path.startsWith('http://') || path.startsWith('https://')
}

function uint8ArrayFromBase64(base64: string): Uint8Array {
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/fromBase64
  if ('fromBase64' in Uint8Array && typeof Uint8Array.fromBase64 === 'function') {
    return Uint8Array.fromBase64(base64)
  }
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

// regex based inlining for packages/ui/dist/client/index.html
async function inlineHtmlAssets(file: string, content: string): Promise<string> {
  const baseDir = dirname(file)
  content = content.replace(
    /<link rel="icon" href="\.\/favicon\.ico" sizes="48x48">\n/,
    '',
  )
  content = content.replace(
    /<link rel="icon" href="(\.\/favicon\.svg)" sizes="any" type="image\/svg\+xml">/,
    (_, asset: string) => {
      const icon = readFileSync(resolve(baseDir, asset)).toString('base64')
      return `<link rel="icon" href="data:image/svg+xml;base64,${icon}" sizes="any" type="image/svg+xml">`
    },
  )
  content = content.replace(
    /<script type="module" src="(\.\/assets\/[^"]+\.js)"><\/script>/,
    (_, asset: string) => `<script type="module">${escapeInlineScript(readFileSync(resolve(baseDir, asset), 'utf-8'))}</script>`,
  )
  content = content.replace(
    /<link rel="stylesheet" href="(\.\/assets\/[^"]+\.css)">/,
    (_, asset: string) => `<style>${escapeInlineStyle(readFileSync(resolve(baseDir, asset), 'utf-8'))}</style>`,
  )
  return content
}

function escapeInlineScript(content: string): string {
  // https://github.com/devongovett/rsc-html-stream/blob/9b858445f4f5817470f373ae266dea04d5fcfac3/server.js#L94-L102
  return content
    .replace(/<!--/g, '<\\!--')
    .replace(/<\/(script)/gi, '</\\$1')
}

function escapeInlineStyle(content: string): string {
  return content.replace(/<\/style/gi, '<\\/style')
}
