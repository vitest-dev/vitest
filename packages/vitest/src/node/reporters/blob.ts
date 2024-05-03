import { readFile, writeFile } from 'node:fs/promises'
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
    const outputFile = this.options.outputFile ?? getOutputFile(this.ctx.config, 'blob') ?? 'blob.json'
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

export function readBlobs(blobs: string[]) {
  const promises = blobs.map(async (path) => {
    // resolve relative to process.cwd, since it's the only way to pass them dowwn
    const resolvedPath = resolve(process.cwd(), path)
    const content = await readFile(resolvedPath, 'utf-8')
    const [files, errors] = parse(content) as [files: File[], errors: unknown[]]
    return { files, errors }
  })
  return Promise.all(promises)
}
