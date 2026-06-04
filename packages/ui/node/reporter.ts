import type { SerializedError, TestAttachment } from 'vitest'
import type { HTMLOptions, Reporter, ResolvedConfig, RunnerTask, RunnerTestFile, TestModule, Vitest } from 'vitest/node'
import type { HTMLReportMetadata } from '../client/composables/client/static'
import { existsSync, promises as fs, readFileSync } from 'node:fs'
import { promisify } from 'node:util'
import { gzip, constants as zlibConstants } from 'node:zlib'
import { stringify } from 'flatted'
import { dirname, relative, resolve } from 'pathe'
import c from 'tinyrainbow'
import { getModuleGraph } from '../../vitest/src/utils/graph'
import { distClientRoot } from './paths'

const gzipAsync = promisify(gzip)

function getOutputFile(config: ResolvedConfig) {
  if (!config.outputFile) {
    return
  }

  if (typeof config.outputFile === 'string') {
    return config.outputFile
  }

  return config.outputFile.html
}

export default class HTMLReporter implements Reporter {
  ctx!: Vitest
  options: HTMLOptions

  private reporterDir!: string

  constructor(options: HTMLOptions) {
    this.options = options
  }

  async onInit(ctx: Vitest): Promise<void> {
    this.ctx = ctx
    const htmlFile
      = this.options.outputFile
        || getOutputFile(this.ctx.config)
        || 'html/index.html'
    const htmlFilePath = resolve(this.ctx.config.root, htmlFile)
    this.reporterDir = dirname(htmlFilePath)
  }

  async onTestRunEnd(
    testModules: ReadonlyArray<TestModule>,
    unhandledErrors: ReadonlyArray<SerializedError>,
  ): Promise<void> {
    const result = await serializeReportMetadata(
      this.ctx,
      testModules,
      unhandledErrors,
    )
    if (this.options.singleFile) {
      await inlineAttachments(result.files)
    }

    // copy ui assets
    await fs.cp(distClientRoot, this.reporterDir, { recursive: true })

    // create index.html and metadata
    const rawData = stringify(result)
    const data = await gzipAsync(rawData, {
      level: zlibConstants.Z_BEST_COMPRESSION,
    })
    await handleIndexHtml({
      srcDir: distClientRoot,
      dstDir: this.reporterDir,
      data,
      singleFile: this.options.singleFile,
    })

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

async function serializeReportMetadata(
  ctx: Vitest,
  testModules: ReadonlyArray<TestModule>,
  unhandledErrors: ReadonlyArray<SerializedError>,
) {
  const result: HTMLReportMetadata = {
    files: [],
    config: ctx.serializedRootConfig,
    unhandledErrors: [...unhandledErrors],
    moduleGraph: {},
    testModules: [],
    sourceCode: {
      codeTable: [],
      testModules: {},
    },
  }

  // dedupe based on project relative paths since
  // they can have different absolute paths for different test runs
  // when merging with platform blob labels and shards.
  // Source code is stored in a separate table so the same file included
  // in multiple projects can share the content while keeping distinct
  // project-relative test module entries.
  const testModuleCodes = result.sourceCode.testModules
  const codeIndexes = new Map<string, number>()
  function getCodeIndex(code: string) {
    const existing = codeIndexes.get(code)
    if (existing != null) {
      return existing
    }
    const index = result.sourceCode.codeTable.length
    codeIndexes.set(code, index)
    result.sourceCode.codeTable.push(code)
    return index
  }

  const promises: Promise<void>[] = []

  for (const testModule of testModules) {
    result.files.push(testModule.task)

    const project = testModule.project
    const projectName = project.name
    result.testModules.push({
      projectName,
      moduleId: testModule.moduleId,
      relativeModuleId: testModule.relativeModuleId,
    })

    testModuleCodes[projectName] ??= {}
    if (testModuleCodes[projectName][testModule.relativeModuleId] == null) {
      try {
        const code = readFileSync(
          testModule.moduleId,
          'utf-8',
        )
        testModuleCodes[projectName][testModule.relativeModuleId] = getCodeIndex(code)
      }
      catch {}
    }

    // TODO: https://github.com/vitest-dev/vitest/issues/9763
    promises.push((async () => {
      result.moduleGraph[projectName] ??= {}
      result.moduleGraph[projectName][testModule.moduleId] = await getModuleGraph(
        ctx,
        projectName,
        testModule.moduleId,
      )
    })())
  }

  await Promise.all(promises)

  return result
}

async function handleIndexHtml(options: {
  dstDir: string
  srcDir: string
  data: Buffer
  singleFile?: boolean
}): Promise<void> {
  const indexHtmlFilePath = resolve(options.srcDir, 'index.html')
  let html = await fs.readFile(indexHtmlFilePath, 'utf-8')
  let metadataCode: string

  if (options.singleFile) {
    html = await inlineHtmlAssets(indexHtmlFilePath, html)
    const base64 = options.data.toString('base64')
    metadataCode = `Promise.resolve((${uint8ArrayFromBase64.toString()})("${base64}"))`
  }
  else {
    const dataFile = 'html.meta.json.gz'
    await fs.writeFile(resolve(options.dstDir, dataFile), options.data)
    metadataCode = `fetch(new URL("./${dataFile}", window.location.href)).then(async res => new Uint8Array(await res.arrayBuffer()))`
  }

  await fs.writeFile(
    resolve(options.dstDir, 'index.html'),
    html.replace(
      '<!-- !LOAD_METADATA! -->',
      `<script>window.HTML_REPORT_METADATA=${metadataCode}</script>`,
    ),
  )
}

async function inlineAttachments(files: RunnerTestFile[]): Promise<void> {
  for (const file of files) {
    await inlineTaskAttachments(file)
  }
}

async function inlineTaskAttachments(task: RunnerTask): Promise<void> {
  if (task.type === 'suite') {
    for (const child of task.tasks) {
      await inlineTaskAttachments(child)
    }
  }
  if (task.type === 'test') {
    for (const annotation of task.annotations) {
      if (annotation.attachment) {
        await inlineTestAttachment(annotation.attachment)
      }
    }
    for (const artifact of task.artifacts) {
      for (const attachment of artifact.attachments ?? []) {
        await inlineTestAttachment(attachment)
      }
    }
  }
}

async function inlineTestAttachment(attachment: TestAttachment): Promise<void> {
  if (attachment.path && !attachment.path.startsWith('http://') && !attachment.path.startsWith('https://')) {
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
