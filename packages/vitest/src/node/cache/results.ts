import type { File } from '../../runtime/runner/types'
import type { Vitest } from '../core'
import type { TestModule, TestModuleState, TestSuite } from '../reporters/reported-tasks'
import type { TestSpecification } from '../test-specification'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, stat } from 'node:fs/promises'
import { dirname, relative, resolve } from 'pathe'
import { createDebugger } from '../../utils/debugger'
import { tagCacheDir } from './cachedirTag'
import { atomicWriteFile } from './fsModuleCache'

const debug = createDebugger('vitest:cache:results')

const RESULTS_VERSION = 1

export interface CachedTestFileResult {
  /**
   * The file has a known failure.
   * A complete run of the file clears it, or a run in which every known failed test passes.
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
  /**
   * Full names of the tests that failed in the last run of the file. `--last-failed` runs only these tests.
   * It is not set if the failure happened outside of tests, for example in a hook or during collection.
   */
  failedTests?: string[]
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
  private recordedModules = new WeakSet<TestModule>()
  private path: string | null
  // the version of the file that this process read or wrote last
  private fileStamp: string | undefined

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
    const path = this.path
    const stamp = path ? await getFileStamp(path) : undefined
    // the file does not exist, or this process already has its content
    if (!path || !stamp || stamp === this.fileStamp) {
      return
    }
    this.fileStamp = stamp
    try {
      const { version, projects }: SerializedResults = JSON.parse(await readFile(path, 'utf-8'))
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
      const testModule = specification.testModule
      const state = testModule?.state()
      // a file that did not start in this run still has the module of a previous run
      if (!testModule || this.recordedModules.has(testModule) || !isFinalState(state)) {
        continue
      }
      this.recordedModules.add(testModule)

      const project = this.getProjectResults(specification.project.name)
      const results = testModule.meta().typecheck ? project.typecheck : project.files
      const file = this.getFilePath(specification)
      const previous = results.get(file)
      const failed = state === 'failed'
      const duration = Math.max(testModule.diagnostic().duration, 0)

      let record: CachedTestFileResult
      if (!isPartialRun(this.vitest, specification, testModule.task)) {
        record = { failed, duration, lastRun: startTime }
        if (failed) {
          setFailedTests(record, getFailedTests(testModule))
        }
      } else if (failed) {
        record = { duration, ...previous, failed }
        // a file that failed outside of tests stays a whole-file failure until a complete run
        if (!previous?.failed || previous.failedTests) {
          setFailedTests(record, mergeFailedTests(previous?.failedTests, testModule))
        }
      } else if (previous?.failedTests) {
        record = { ...previous }
        setFailedTests(record, mergeFailedTests(previous.failedTests, testModule))
        record.failed = !!record.failedTests
      } else if (!previous) {
        record = { failed, duration }
      } else {
        continue
      }
      results.set(file, record)
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
    this.fileStamp = undefined
    if (this.path && existsSync(this.path)) {
      await rm(this.path, { force: true })
      this.vitest.logger.log('[cache] cleared results cache at', this.path)
    }
  }

  private getFilePath(specification: TestSpecification): string {
    return getRootRelativePath(this.vitest.config.root, specification.moduleId)
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
      const cacheDir = dirname(this.path)
      await mkdir(cacheDir, { recursive: true })
      // the cache is in "cacheDir/vitest/<hash>", Vitest owns the "vitest" directory
      tagCacheDir(dirname(cacheDir))
      await atomicWriteFile(this.path, JSON.stringify(results))
      this.fileStamp = await getFileStamp(this.path)
    } catch (error) {
      debug?.(`failed to write ${this.path}: ${error}`)
    }
  }
}

function isFinalState(state: TestModuleState | undefined): boolean {
  return state === 'passed' || state === 'failed' || state === 'skipped'
}

function setFailedTests(record: CachedTestFileResult, failedTests: string[] | undefined): void {
  if (failedTests) {
    record.failedTests = failedTests
  } else {
    delete record.failedTests
  }
}

interface CollectedTests {
  failed: string[]
  passed: string[]
}

// returns true if a failure happened outside of tests, for example in a hook
function collectTests(suite: TestModule | TestSuite, collected: CollectedTests): boolean {
  if (suite.errors().length) {
    return true
  }
  for (const child of suite.children) {
    if (child.type === 'suite') {
      if (collectTests(child, collected)) {
        return true
      }
      continue
    }
    const state = child.result().state
    if (state === 'failed') {
      collected.failed.push(child.fullName)
    } else if (state === 'passed') {
      collected.passed.push(child.fullName)
    }
  }
  return false
}

function getFailedTests(testModule: TestModule): string[] | undefined {
  const collected: CollectedTests = { failed: [], passed: [] }
  if (collectTests(testModule, collected) || !collected.failed.length) {
    return undefined
  }
  return collected.failed
}

// the known failures after a partial run; a test that did not run keeps its state
function mergeFailedTests(
  previous: string[] | undefined,
  testModule: TestModule,
): string[] | undefined {
  const collected: CollectedTests = { failed: [], passed: [] }
  if (collectTests(testModule, collected)) {
    return undefined
  }
  const names = new Set(previous)
  for (const name of collected.passed) {
    names.delete(name)
  }
  for (const name of collected.failed) {
    names.add(name)
  }
  return names.size ? Array.from(names) : undefined
}

// a partial run does not prove that the whole file passes
export function isPartialRun(
  vitest: Vitest,
  specification: TestSpecification,
  task: File,
): boolean {
  return !!(
    vitest.isCancelling ||
    task.containsOnly ||
    specification.testLines?.length ||
    specification.testIds?.length ||
    specification.testNames?.length ||
    specification.testNamePattern ||
    specification.testTagsFilter?.length ||
    vitest.getGlobalTestNamePattern() ||
    vitest.config.tagsFilter?.length
  )
}

// relative to the root, so the cache is the same in CI and locally
export function getRootRelativePath(root: string, file: string): string {
  // "relative" normalizes both paths, which is slow for thousands of files
  if (file.startsWith(root) && file[root.length] === '/') {
    return file.slice(root.length + 1)
  }
  return relative(root, file)
}

// every write replaces the file, so a write by another process changes the inode
export async function getFileStamp(path: string): Promise<string | undefined> {
  const stats = await stat(path).catch(() => undefined)
  return stats && `${stats.ino}:${stats.mtimeMs}:${stats.size}`
}
