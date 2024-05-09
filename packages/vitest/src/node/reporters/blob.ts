import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { parse, stringify } from 'flatted'
import { dirname, resolve } from 'pathe'
import type { File, Reporter, Vitest } from '../../types'
import { getOutputFile } from '../../utils/config-helpers'

export interface BlobOptions {
  outputFile?: string
}

export class BlobReporter implements Reporter {
  ctx!: Vitest
  options: BlobOptions

  constructor(options: BlobOptions) {
    this.options = options
  }

  onInit(ctx: Vitest): void {
    if (ctx.config.watch)
      throw new Error('Blob reporter is not supported in watch mode')

    this.ctx = ctx
  }

  async onFinished(files?: File[], errors?: unknown[]) {
    let outputFile = this.options.outputFile ?? getOutputFile(this.ctx.config, 'blob')
    if (!outputFile) {
      const shard = this.ctx.config.shard
      outputFile = shard
        ? `.vitest-reports/blob-${shard.index}-${shard.count}.json`
        : '.vitest-reports/blob.json'
    }

    const moduleKeys = this.ctx.projects.map((project) => {
      return [project.getName(), [...project.server.moduleGraph.idToModuleMap.keys()]]
    })

    // TODO: store module graph?
    const report = stringify([files, errors, moduleKeys])

    const reportFile = resolve(this.ctx.config.root, outputFile)

    const dir = dirname(reportFile)
    if (!existsSync(dir))
      await mkdir(dir, { recursive: true })

    await writeFile(
      reportFile,
      report,
      'utf-8',
    )
    this.ctx.logger.log('blob report written to', reportFile)
  }
}

export async function readBlobs(blobsDirectory: string) {
  const resolvedDir = resolve(process.cwd(), blobsDirectory)
  const blobs = await readdir(resolvedDir)
  const promises = blobs.map(async (file) => {
    const content = await readFile(resolve(resolvedDir, file), 'utf-8')
    const [files, errors, moduleKeys] = parse(content) as [files: File[], errors: unknown[], [string, string[]][]]
    return { files, errors, moduleKeys }
  })
  return Promise.all(promises)
}
