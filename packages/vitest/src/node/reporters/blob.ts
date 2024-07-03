import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { parse, stringify } from 'flatted'
import { dirname, resolve } from 'pathe'
import { cleanUrl } from 'vite-node/utils'
import type { File, Reporter, Vitest } from '../../types'
import { getOutputFile } from '../../utils/config-helpers'
import type { WorkspaceProject } from '../workspace'

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
    if (ctx.config.watch) {
      throw new Error('Blob reporter is not supported in watch mode')
    }

    this.ctx = ctx
  }

  async onFinished(
    files: File[] = [],
    errors: unknown[] = [],
    coverage: unknown,
  ) {
    let outputFile
      = this.options.outputFile ?? getOutputFile(this.ctx.config, 'blob')
    if (!outputFile) {
      const shard = this.ctx.config.shard
      outputFile = shard
        ? `.vitest-reports/blob-${shard.index}-${shard.count}.json`
        : '.vitest-reports/blob.json'
    }

    const moduleKeys = this.ctx.projects.map<MergeReportModuleKeys>(
      (project) => {
        return [
          project.getName(),
          [...project.server.moduleGraph.idToModuleMap.keys()],
        ]
      },
    )

    const report = stringify([
      this.ctx.version,
      files,
      errors,
      moduleKeys,
      coverage,
    ] satisfies MergeReport)

    const reportFile = resolve(this.ctx.config.root, outputFile)

    const dir = dirname(reportFile)
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }

    await writeFile(reportFile, report, 'utf-8')
    this.ctx.logger.log('blob report written to', reportFile)
  }
}

export async function readBlobs(
  blobsDirectory: string,
  projectsArray: WorkspaceProject[],
) {
  // using process.cwd() because --merge-reports can only be used in CLI
  const resolvedDir = resolve(process.cwd(), blobsDirectory)
  const blobsFiles = await readdir(resolvedDir)
  const promises = blobsFiles.map(async (file) => {
    const content = await readFile(resolve(resolvedDir, file), 'utf-8')
    const [version, files, errors, moduleKeys, coverage] = parse(
      content,
    ) as MergeReport
    return { version, files, errors, moduleKeys, coverage }
  })
  const blobs = await Promise.all(promises)

  if (!blobs.length) {
    throw new Error(
      `vitest.mergeReports() requires at least one blob file paths in the config`,
    )
  }

  // fake module graph - it is used to check if module is imported, but we don't use values inside
  const projects = Object.fromEntries(
    projectsArray.map(p => [p.getName(), p]),
  )

  blobs.forEach((blob) => {
    blob.moduleKeys.forEach(([projectName, moduleIds]) => {
      const project = projects[projectName]
      if (!project) {
        return
      }
      moduleIds.forEach((moduleId) => {
        project.server.moduleGraph.idToModuleMap.set(moduleId, {
          id: moduleId,
          url: moduleId,
          file: cleanUrl(moduleId),
          ssrTransformResult: null,
          transformResult: null,
          importedBindings: null,
          importedModules: new Set(),
          importers: new Set(),
          type: 'js',
          clientImportedModules: new Set(),
          ssrError: null,
          ssrImportedModules: new Set(),
          ssrModule: null,
          acceptedHmrDeps: new Set(),
          acceptedHmrExports: null,
          lastHMRTimestamp: 0,
          lastInvalidationTimestamp: 0,
        })
      })
    })
  })

  const files = blobs
    .flatMap(blob => blob.files)
    .sort((f1, f2) => {
      const time1 = f1.result?.startTime || 0
      const time2 = f2.result?.startTime || 0
      return time1 - time2
    })
  const errors = blobs.flatMap(blob => blob.errors)
  const coverages = blobs.map(blob => blob.coverage)

  return {
    files,
    errors,
    coverages,
  }
}

type MergeReport = [
  vitestVersion: string,
  files: File[],
  errors: unknown[],
  moduleKeys: MergeReportModuleKeys[],
  coverage: unknown,
]

type MergeReportModuleKeys = [projectName: string, moduleIds: string[]]
