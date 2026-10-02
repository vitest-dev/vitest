import type { File } from '../../runtime/runner/types'
import type { Vitest } from '../core'
import type { TestSpecification } from '../test-specification'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, relative, resolve } from 'pathe'
import { createDebugger } from '../../utils/debugger'
import { atomicWriteFile } from './fsModuleCache'

const debug = createDebugger('vitest:cache:results')

const RESULTS_VERSION = 1

export interface CachedTestFileResult {
  /**
   * The file has a known failure. Only a complete run of the file clears it.
   */
  failed: boolean
  /**
   * Duration of the last complete run in milliseconds.
   * A file that never ran completely keeps the duration of its first recorded run.
   */
  duration: number
  /**
   * Unix timestamp in milliseconds of the start of the last complete run.
   * It is not set if the file never ran completely.
   */
  lastRun?: number
}

interface ProjectResults {
  files: Map<string, CachedTestFileResult>
  typecheck: Map<string, CachedTestFileResult>
}

interface SerializedResults {
  version: number
  projects: Record<
    string,
    {
      files?: Record<string, CachedTestFileResult>
      typecheck?: Record<string, CachedTestFileResult>
    }
  >
}

export class ResultsCache {
  private projects = new Map<string, ProjectResults>()
  private legacyResults: Map<string, CachedTestFileResult> | undefined
  private recordedTasks = new WeakSet<File>()
  private path: string | null

  constructor(private vitest: Vitest) {
    this.path = vitest.config.cache ? resolve(vitest.viteConfig.cacheDir, 'results.json') : null
  }

  get(specification: TestSpecification): CachedTestFileResult | undefined {
    const project = this.projects.get(specification.project.name)
    const results = specification.pool === 'typescript' ? project?.typecheck : project?.files
    return results?.get(this.getFilePath(specification))
  }

  getByLegacyKey(key: string): CachedTestFileResult | undefined {
    if (!this.legacyResults) {
      this.legacyResults = new Map()
      for (const [name, { files }] of this.projects) {
        for (const [file, result] of files) {
          this.legacyResults.set(`${name}:${file}`, result)
        }
      }
    }
    return this.legacyResults.get(key)
  }

  async read(): Promise<void> {
    if (!this.path || !existsSync(this.path)) {
      return
    }
    try {
      const { version, projects }: SerializedResults = JSON.parse(
        await readFile(this.path, 'utf-8'),
      )
      if (version !== RESULTS_VERSION) {
        debug?.(`ignored ${this.path}, the version ${version} is not supported`)
        return
      }
      const results = new Map<string, ProjectResults>()
      for (const name in projects) {
        const { files, typecheck } = projects[name]
        results.set(name, {
          files: new Map(Object.entries(files ?? {})),
          typecheck: new Map(Object.entries(typecheck ?? {})),
        })
      }
      this.projects = results
      this.legacyResults = undefined
    } catch (error) {
      debug?.(`failed to read ${this.path}: ${error}`)
    }
  }

  async update(specifications: TestSpecification[], startTime: number): Promise<void> {
    // another process could write new results after this one read the file
    await this.read()

    let changed = false
    for (const specification of specifications) {
      const task = specification.testModule?.task
      const state = task?.result?.state
      // a file that did not start in this run still has the task of a previous run
      if (!task || this.recordedTasks.has(task) || !isFinalState(state)) {
        continue
      }
      this.recordedTasks.add(task)

      const project = this.getProjectResults(specification.project.name)
      const results = task.meta.typecheck ? project.typecheck : project.files
      const file = this.getFilePath(specification)
      const previous = results.get(file)
      const failed = state === 'fail'
      const duration = Math.max(task.result?.duration ?? 0, 0)

      if (!this.isPartialRun(specification, task)) {
        results.set(file, { failed, duration, lastRun: startTime })
      } else if (failed) {
        results.set(file, { duration, ...previous, failed })
      } else if (!previous) {
        results.set(file, { failed, duration })
      } else {
        continue
      }
      changed = true
    }

    if (changed) {
      this.legacyResults = undefined
      await this.write()
    }
  }

  async clear(): Promise<void> {
    this.projects.clear()
    this.legacyResults = undefined
    if (this.path && existsSync(this.path)) {
      await rm(this.path, { force: true })
      this.vitest.logger.log('[cache] cleared results cache at', this.path)
    }
  }

  // a partial run does not prove that the whole file passes
  private isPartialRun(specification: TestSpecification, task: File): boolean {
    return !!(
      this.vitest.isCancelling ||
      task.containsOnly ||
      specification.testLines?.length ||
      specification.testIds?.length ||
      specification.testNamePattern ||
      specification.testTagsFilter?.length ||
      this.vitest.getGlobalTestNamePattern() ||
      this.vitest.config.tagsFilter?.length
    )
  }

  private getFilePath(specification: TestSpecification): string {
    // relative to the root, so the cache is the same in CI and locally
    return relative(this.vitest.config.root, specification.moduleId)
  }

  private getProjectResults(name: string): ProjectResults {
    let project = this.projects.get(name)
    if (!project) {
      project = { files: new Map(), typecheck: new Map() }
      this.projects.set(name, project)
    }
    return project
  }

  private async write(): Promise<void> {
    if (!this.path) {
      return
    }
    const projects: SerializedResults['projects'] = Object.create(null)
    for (const [name, { files, typecheck }] of this.projects) {
      projects[name] = {
        files: files.size ? Object.fromEntries(files) : undefined,
        typecheck: typecheck.size ? Object.fromEntries(typecheck) : undefined,
      }
    }
    const results: SerializedResults = { version: RESULTS_VERSION, projects }
    try {
      await mkdir(dirname(this.path), { recursive: true })
      await atomicWriteFile(this.path, JSON.stringify(results))
    } catch (error) {
      debug?.(`failed to write ${this.path}: ${error}`)
    }
  }
}

function isFinalState(state: string | undefined): boolean {
  return state === 'pass' || state === 'fail' || state === 'skip' || state === 'todo'
}
