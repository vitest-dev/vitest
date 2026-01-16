import type { File } from '@vitest/runner'
import type { SerializedError } from '@vitest/utils'
import type { ModuleGraphData } from '../../types/general'
import type { Vitest } from '../core'
import type { TestProject } from '../project'
import type { Reporter } from '../types/reporter'
import type { TestModule } from './reported-tasks'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { parse, stringify } from 'flatted'
import { dirname, resolve } from 'pathe'
import { getOutputFile } from '../../utils/config-helpers'
import { getModuleGraph } from '../../utils/graph'

export interface BlobOptions {
  outputFile?: string
}

export class BlobReporter implements Reporter {
  start = 0
  ctx!: Vitest
  options: BlobOptions
  coverage: unknown | undefined

  constructor(options: BlobOptions) {
    this.options = options
  }

  onInit(ctx: Vitest): void {
    if (ctx.config.watch) {
      throw new Error('Blob reporter is not supported in watch mode')
    }

    this.ctx = ctx
    this.start = performance.now()
    this.coverage = undefined
  }

  onCoverage(coverage: unknown): void {
    this.coverage = coverage
  }

  async onTestRunEnd(testModules: ReadonlyArray<TestModule>, unhandledErrors: ReadonlyArray<SerializedError>): Promise<void> {
    const executionTime = performance.now() - this.start

    const files = testModules.map(testModule => testModule.task)
    const errors = [...unhandledErrors]
    const coverage = this.coverage

    let outputFile
      = this.options.outputFile ?? getOutputFile(this.ctx.config, 'blob')
    if (!outputFile) {
      const shard = this.ctx.config.shard
      outputFile = shard
        ? `.vitest-reports/blob-${shard.index}-${shard.count}.json`
        : '.vitest-reports/blob.json'
    }

    const modules = this.ctx.projects.map<MergeReportModuleKeys>(
      (project) => {
        return [
          project.name,
          [...project.vite.moduleGraph.idToModuleMap.entries()].map<SerializedModuleNode | null>((mod) => {
            if (!mod[1].file) {
              return null
            }
            return [mod[0], mod[1].file, mod[1].url]
          }).filter(x => x != null),
        ]
      },
    )

    // Build module ID to index map for efficient graph storage
    const moduleIdToIndex = new Map<string, number>()
    const projectModuleOffsets = new Map<string, number>()
    let globalModuleIndex = 0

    modules.forEach(([projectName, projectModules]) => {
      projectModuleOffsets.set(projectName, globalModuleIndex)
      projectModules.forEach((mod) => {
        moduleIdToIndex.set(mod[0], globalModuleIndex++)
      })
    })

    // Capture module graph relationships using indices instead of full IDs
    const graphData: Record<string, number[][]> = {}
    await Promise.all(
      files.map(async (file) => {
        const projectName = file.projectName || ''
        const project = this.ctx.getProjectByName(projectName)
        const browser = project.config.browser.enabled

        try {
          const moduleGraph = await getModuleGraph(
            this.ctx,
            projectName,
            file.filepath,
            browser,
          )

          // Convert graph to use indices instead of module IDs
          const fileGraphEdges: number[][] = []
          Object.entries(moduleGraph.graph).forEach(([moduleId, deps]) => {
            const sourceIdx = moduleIdToIndex.get(moduleId)
            if (sourceIdx !== undefined) {
              deps.forEach((depId) => {
                const targetIdx = moduleIdToIndex.get(depId)
                if (targetIdx !== undefined) {
                  fileGraphEdges.push([sourceIdx, targetIdx])
                }
              })
            }
          })

          graphData[file.filepath] = fileGraphEdges
        }
        catch (error) {
          // If module graph generation fails, use empty graph
          this.ctx.logger.error('Failed to generate module graph for', file.filepath, error)
          graphData[file.filepath] = []
        }
      }),
    )

    const report = [
      this.ctx.version,
      files,
      errors,
      modules,
      coverage,
      executionTime,
      graphData,
    ] satisfies MergeReport

    const reportFile = resolve(this.ctx.config.root, outputFile)
    await writeBlob(report, reportFile)

    this.ctx.logger.log('blob report written to', reportFile)
  }
}

export async function writeBlob(content: MergeReport, filename: string): Promise<void> {
  const report = stringify(content)

  const dir = dirname(filename)
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }

  await writeFile(filename, report, 'utf-8')
}

export async function readBlobs(
  currentVersion: string,
  blobsDirectory: string,
  projectsArray: TestProject[],
): Promise<MergedBlobs> {
  // using process.cwd() because --merge-reports can only be used in CLI
  const resolvedDir = resolve(process.cwd(), blobsDirectory)
  const blobsFiles = await readdir(resolvedDir)
  const promises = blobsFiles.map(async (filename) => {
    const fullPath = resolve(resolvedDir, filename)
    const stats = await stat(fullPath)
    if (!stats.isFile()) {
      throw new TypeError(
        `vitest.mergeReports() expects all paths in "${blobsDirectory}" to be files generated by the blob reporter, but "${filename}" is not a file`,
      )
    }
    const content = await readFile(fullPath, 'utf-8')
    const parsed = parse(content) as MergeReport
    const [version, files, errors, moduleKeys, coverage, executionTime, graphData] = parsed
    if (!version) {
      throw new TypeError(
        `vitest.mergeReports() expects all paths in "${blobsDirectory}" to be files generated by the blob reporter, but "${filename}" is not a valid blob file`,
      )
    }
    return { version, files, errors, moduleKeys, coverage, file: filename, executionTime, graphData: graphData || {} }
  })
  const blobs = await Promise.all(promises)

  if (!blobs.length) {
    throw new Error(
      `vitest.mergeReports() requires at least one blob file in "${blobsDirectory}" directory, but none were found`,
    )
  }

  const versions = new Set(blobs.map(blob => blob.version))
  if (versions.size > 1) {
    throw new Error(
      `vitest.mergeReports() requires all blob files to be generated by the same Vitest version, received\n\n${blobs.map(b => `- "${b.file}" uses v${b.version}`).join('\n')}`,
    )
  }

  if (!versions.has(currentVersion)) {
    throw new Error(
      `the blobs in "${blobsDirectory}" were generated by a different version of Vitest. Expected v${currentVersion}, but received v${blobs[0].version}`,
    )
  }

  // fake module graph - it is used to check if module is imported, but we don't use values inside
  const projects = Object.fromEntries(
    projectsArray.map(p => [p.name, p]),
  )

  // Build a global module index to ID map
  const allModules: SerializedModuleNode[] = []
  blobs.forEach((blob) => {
    blob.moduleKeys.forEach(([_projectName, moduleIds]) => {
      allModules.push(...moduleIds)
    })
  })

  blobs.forEach((blob) => {
    blob.moduleKeys.forEach(([projectName, moduleIds]) => {
      const project = projects[projectName]
      if (!project) {
        return
      }
      moduleIds.forEach(([moduleId, file, url]) => {
        const moduleNode = project.vite.moduleGraph.createFileOnlyEntry(file)
        moduleNode.url = url
        moduleNode.id = moduleId
        moduleNode.transformResult = {
          // print error checks that transformResult is set
          code: ' ',
          map: null,
        }
        project.vite.moduleGraph.idToModuleMap.set(moduleId, moduleNode)
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
  const executionTimes = blobs.map(blob => blob.executionTime)

  // Reconstruct module graph data from indexed edges
  const moduleGraphData: Record<string, Record<string, ModuleGraphData>> = {}
  blobs.forEach((blob) => {
    Object.entries(blob.graphData).forEach(([filepath, edges]) => {
      // Find the project for this file
      const file = blob.files.find(f => f.filepath === filepath)
      if (!file) {
        return
      }
      const projectName = file.projectName || ''

      moduleGraphData[projectName] ??= {}

      // Convert edges back to ModuleGraphData format
      const graph: Record<string, string[]> = {}
      const inlinedSet = new Set<string>()
      const externalizedSet = new Set<string>()

      edges.forEach(([sourceIdx, targetIdx]) => {
        const sourceModule = allModules[sourceIdx]
        const targetModule = allModules[targetIdx]
        if (sourceModule && targetModule) {
          const sourceId = sourceModule[0]
          const targetId = targetModule[0]
          if (!graph[sourceId]) {
            graph[sourceId] = []
          }
          graph[sourceId].push(targetId)
          inlinedSet.add(sourceId)
          inlinedSet.add(targetId)
        }
      })

      moduleGraphData[projectName][filepath] = {
        graph,
        externalized: Array.from(externalizedSet),
        inlined: Array.from(inlinedSet),
      }
    })
  })

  return {
    files,
    errors,
    coverages,
    executionTimes,
    moduleGraphData,
  }
}

export interface MergedBlobs {
  files: File[]
  errors: unknown[]
  coverages: unknown[]
  executionTimes: number[]
  moduleGraphData: Record<string, Record<string, ModuleGraphData>>
}

type MergeReport = [
  vitestVersion: string,
  files: File[],
  errors: unknown[],
  modules: MergeReportModuleKeys[],
  coverage: unknown,
  executionTime: number,
  graphData?: Record<string, number[][]>,
]

type SerializedModuleNode = [
  id: string,
  file: string,
  url: string,
]

type MergeReportModuleKeys = [
  projectName: string,
  modules: SerializedModuleNode[],
]
