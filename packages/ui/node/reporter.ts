import type { SerializedError } from 'vitest'
import type { HTMLOptions, Reporter, TestModule, Vitest } from 'vitest/node'
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

  async onTestRunEnd(
    testModules: ReadonlyArray<TestModule>,
    unhandledErrors: ReadonlyArray<SerializedError>,
  ): Promise<void> {
    const result = await serializeReportMetadata(
      this.ctx,
      testModules,
      unhandledErrors,
    )
    const report = stringify(result)

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
        project.config.browser.enabled,
      )
    })())
  }

  await Promise.all(promises)

  return result
}
