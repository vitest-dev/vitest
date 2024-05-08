import { readFile, readdir, writeFile } from 'node:fs/promises'
import { parse, stringify } from 'flatted'
import { resolve } from 'pathe'
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
      throw new Error(`Blob reporter is not supported in watch mode`)

    this.ctx = ctx
  }

  async onFinished(files?: File[], errors?: unknown[]) {
    let outputFile = this.options.outputFile ?? getOutputFile(this.ctx.config, 'blob')
    if (!outputFile) {
      const shard = this.ctx.config.shard
      outputFile = shard ? `blob-${shard.index}-${shard.count}.json` : 'blob.json'
    }

    // TODO: store module graph?
    const report = stringify([files, errors])

    const reportFile = resolve(this.ctx.config.root, outputFile)
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
  const blobs = (await readdir(resolvedDir)).map(file => resolve(resolvedDir, file))
  const promises = blobs.map(async (path) => {
    const content = await readFile(path, 'utf-8')
    const [files, errors] = parse(content) as [files: File[], errors: unknown[]]
    return { files, errors }
  })
  return Promise.all(promises)
}
