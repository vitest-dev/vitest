import { readFileSync } from 'node:fs'
import type { TestError } from '@vitest/utils'
import mm from 'micromatch'
import { slash } from '../utils'
import type { TestModule } from './reporters/reported-tasks'
import type { Vitest as VitestCore } from './core'
import type { TestSpecification } from './spec'

export interface VitestRunner {
  // Vitest starts a standalone runner, will react on watch changes, it doesn't run tests
  start: () => void
  stop: () => void

  // file -> spec[]
  // unique by project+pool, creating a new spec overrides the old one
  readonly specifications: Map<string, Array<TestSpecification>>

  run: () => Promise<TestRunResult>
  collect: () => Promise<TestRunResult>
  runModules: (moduleNames: string[]) => Promise<TestRunResult>
  runTests: (filters: Array<TestSpecification>) => Promise<TestRunResult>
  mergeReports: () => Promise<TestRunResult>
}

const kVitest = Symbol('vitest')

export class VitestRunner_ implements VitestRunner {
  private readonly [kVitest]: VitestCore

  private _stop = () => {}
  private _invalidates = new Set<string>()
  private _changedTests = new Set<string>()

  constructor(
    vitest: VitestCore,
  ) {
    this[kVitest] = vitest
  }

  start(): void {
    const watcher = this[kVitest].server.watcher

    watcher.on('change', this.onFileChanged)
    watcher.on('unlink', this.onFileRemoved)
    watcher.on('add', this.onFileCreated)

    this._stop = () => {
      watcher.off('change', this.onFileChanged)
      watcher.off('unlink', this.onFileRemoved)
      watcher.off('add', this.onFileCreated)
      this._stop = () => {}
    }
  }

  async run(): Promise<TestRunResult> {
    return {
      testModules: [],
      errors: [],
    }
  }

  async collect(): Promise<TestRunResult> {
    return {
      testModules: [],
      errors: [],
    }
  }

  async runModules(_moduleNames: string[]): Promise<TestRunResult> {
    return {
      testModules: [],
      errors: [],
    }
  }

  async runTests(_filters: TestSpecification[]): Promise<TestRunResult> {
    return {
      testModules: [],
      errors: [],
    }
  }

  async mergeReports(): Promise<TestRunResult> {
    return {
      testModules: [],
      errors: [],
    }
  }

  stop() {
    this._stop()
  }

  private onFileChanged = safe((file: string) => {
    file = slash(file)
    this[kVitest].logger.clearHighlightCache(file)
    this.moduleGraph.invalidateViteModulesByFile(file)

    if (this.shouldRerun(file)) {
      this.scheduleRerun(file)
    }
  })

  private onFileRemoved = safe((file: string) => {
    file = slash(file)
    this[kVitest].logger.clearHighlightCache(file)
    this._invalidates.add(file)
    this.moduleGraph.invalidateViteModulesByFile(file)

    const state = this[kVitest].state
    const cache = this[kVitest].cache
    const testFiles = state.filesMap.get(file)
    if (!testFiles) {
      return
    }

    // clear all caches that we keep for this file
    state.filesMap.delete(file)
    cache.results.removeFromCache(file)
    cache.stats.removeStats(file)
    this._changedTests.delete(file)
    this[kVitest].report('onTestRemoved', file)
  })

  private onFileCreated = safe((file: string) => {
    file = slash(file)
    this.moduleGraph.invalidateViteModulesByFile(file)

    const source = readFileSync(file, 'utf-8')

    const fileProjects = this[kVitest].projects.filter((project) => {
      if (project.isTargetFile(file, source)) {
        // this is an array of all tests files that are related to this project
        // it is populated at the start, we need to keep it up to date
        project.testFilesList?.push(file)
        return true
      }
      return false
    })

    if (fileProjects.length) {
      this._changedTests.add(file)
      this.scheduleRerun(file)
    }
    else {
      // it's possible that file was already there but watcher triggered "add" event instead
      if (this.shouldRerun(file)) {
        this.scheduleRerun(file)
      }
    }
  })

  private _restartsCount = 0
  private _rerunTimer: any
  private _runningPromise: Promise<void> | null = null

  private async scheduleRerun(file: string) {
    const currentCount = this._restartsCount
    clearTimeout(this._rerunTimer)
    await this._runningPromise
    clearTimeout(this._rerunTimer)

    // server restarted
    if (this._restartsCount !== currentCount) {
      return
    }

    this._rerunTimer = setTimeout(async () => {
      // TODO: run only watched tests

      if (this._changedTests.size === 0) {
        this._invalidates.clear()
        return
      }

      // server restarted
      if (this._restartsCount !== currentCount) {
        return
      }

      this.isFirstRun = false

      this.snapshot.clear()
      let files = Array.from(this.changedTests)

      if (this.filenamePattern) {
        const filteredFiles = await this.globTestFiles([this.filenamePattern])
        files = files.filter(file => filteredFiles.some(f => f[1] === file))

        // A file that does not match the current filename pattern was changed
        if (files.length === 0) {
          return
        }
      }

      this.changedTests.clear()

      const triggerIds = new Set(triggerId.map(id => relative(this.config.root, id)))
      const triggerLabel = Array.from(triggerIds).join(', ')
      await this.report('onWatcherRerun', files, triggerLabel)

      await this.runFiles(files.flatMap(file => this.getProjectsByTestFile(file)), false)

      await this.report('onWatcherStart', this.state.getFiles(files))
    }, WATCHER_DEBOUNCE)
  }

  private shouldRerun(filepath: string): boolean {
    if (this._changedTests.has(filepath) || this._invalidates.has(filepath)) {
      return false
    }

    const state = this[kVitest].state

    if (mm.isMatch(filepath, this[kVitest].config.forceRerunTriggers)) {
      state.getFilepaths().forEach(file => this._changedTests.add(file))
      return true
    }

    const projects = this[kVitest].projects.filter((project) => {
      const moduleNode = project.server.moduleGraph.getModulesByFile(filepath)
      return moduleNode && moduleNode.size > 0
    })
    if (!projects.length) {
      // if there are no modules it's possible that server was restarted
      // we don't have information about importers anymore, so let's check if the file is a test file at least
      if (state.filesMap.has(filepath) || this[kVitest].projects.some(project => project.isTestFile(filepath))) {
        this._changedTests.add(filepath)
        return true
      }
      return false
    }

    const files: string[] = []

    for (const project of projects) {
      const mods = project.getModulesByFilepath(filepath)
      if (!mods.size) {
        continue
      }

      this._invalidates.add(filepath)

      // one of test files that we already run, or one of test files that we can run
      if (state.filesMap.has(filepath) || project.isTestFile(filepath)) {
        this._changedTests.add(filepath)
        files.push(filepath)
        continue
      }

      let rerun = false
      for (const mod of mods) {
        mod.importers.forEach((i) => {
          if (!i.file) {
            return
          }

          const heedsRerun = this.shouldRerun(i.file)
          if (heedsRerun) {
            rerun = true
          }
        })
      }

      if (rerun) {
        files.push(filepath)
      }
    }

    return files.length > 0
  }
}

interface TestRunResult {
  testModules: TestModule[]
  errors: TestError[]
}

function safe<T>(cb: (...args: T[]) => void) {
  return (...args: T[]) => {
    try {
      cb(...args)
    }
    catch {}
  }
}
