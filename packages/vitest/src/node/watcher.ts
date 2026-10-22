import type { Vitest } from './core'
import type { TestProject } from './project'
import { readFileSync } from 'node:fs'
import { noop, slash } from '@vitest/utils/helpers'
import { resolve } from 'pathe'
import pm from 'picomatch'
import { normalize } from 'node:path'

type EventName = 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir'

type TrackEventName = EventName | 'any'
type FileTrackers = Map<string, Set<PromiseWithResolvers<void>>>
type EventTrackers = Map<TrackEventName, FileTrackers>

export type Track = (
  filepath: string,
  options?: {
    timeout?: number
    type?: TrackEventName
  },
) => Promise<void>

export class VitestWatcher {
  /**
   * Modules that will be invalidated on the next run.
   */
  public readonly invalidates: Set<string> = new Set()
  /**
   * Test files that have changed and need to be rerun.
   */
  public readonly changedTests: Set<string> = new Set()

  private readonly _onRerun: ((file: string) => void)[] = []
  private trackers: EventTrackers = new Map()

  constructor(private vitest: Vitest) {}

  /**
   * Register a handler that will be called when test files need to be rerun.
   * The callback can receive several files in case the changed file is imported by several test files.
   * Several invocations of this method will add multiple handlers.
   * @internal
   */
  onWatcherRerun(cb: (file: string) => void): this {
    this._onRerun.push(cb)
    return this
  }

  public close(): void {
    this.vitest.vite.watcher.close()
  }

  public unregisterWatcher: () => void = noop
  public registerWatcher(): this {
    const watcher = this.vitest.vite.watcher

    if (this.vitest.config.forceRerunTriggers.length) {
      watcher.add(this.vitest.config.forceRerunTriggers)
    }

    watcher.on('change', this.onFileChange)
    watcher.on('unlink', this.onFileDelete)
    watcher.on('add', this.onFileCreate)

    this.unregisterWatcher = () => {
      watcher.off('change', this.onFileChange)
      watcher.off('unlink', this.onFileDelete)
      watcher.off('add', this.onFileCreate)
      this.unregisterWatcher = noop
    }
    return this
  }

  private scheduleRerun(file: string): void {
    this._onRerun.forEach((cb) => cb(file))
  }

  private getTestFilesFromWatcherTrigger(id: string): boolean {
    if (!this.vitest.config.watchTriggerPatterns) {
      return false
    }
    let triggered = false
    this.vitest.config.watchTriggerPatterns.forEach((definition) => {
      const exec = definition.pattern.exec(id)
      if (exec) {
        const files = definition.testsToRun(id, exec)
        if (Array.isArray(files)) {
          triggered = true
          files.forEach((file) => this.changedTests.add(resolve(this.vitest.config.root, file)))
        } else if (typeof files === 'string') {
          triggered = true
          this.changedTests.add(resolve(this.vitest.config.root, files))
        }
      }
    })
    return triggered
  }

  public onFileChange = (id: string): void => {
    id = slash(id)
    this.vitest.logger.clearHighlightCache(id)
    this.vitest.invalidateFile(id)
    const testFiles = this.getTestFilesFromWatcherTrigger(id)
    if (testFiles) {
      this.scheduleRerun(id)
    } else {
      const needsRerun = this.handleFileChanged(id)
      if (needsRerun) {
        this.scheduleRerun(id)
      }
    }
  }

  public onFileDelete = (id: string): void => {
    id = slash(id)
    this.vitest.logger.clearHighlightCache(id)
    this.invalidates.add(id)

    if (this.vitest.state.filesMap.has(id)) {
      this.vitest.projects.forEach((project) => project._removeCachedTestFile(id))
      this.vitest.state.filesMap.delete(id)
      this.vitest.cache.results.removeFromCache(id)
      this.vitest.cache.stats.removeStats(id)
      this.changedTests.delete(id)
      this.vitest.report('onTestRemoved', id)
    }
  }

  public onFileCreate = (id: string): void => {
    id = slash(id)
    this.vitest.invalidateFile(id)

    const testFiles = this.getTestFilesFromWatcherTrigger(id)
    if (testFiles) {
      this.scheduleRerun(id)
      return
    }

    let fileContent: string | undefined

    const matchingProjects: TestProject[] = []
    this.vitest.projects.forEach((project) => {
      if (project.matchesTestGlob(id, () => (fileContent ??= readFileSync(id, 'utf-8')))) {
        matchingProjects.push(project)
      }
    })

    if (matchingProjects.length > 0) {
      this.changedTests.add(id)
      this.scheduleRerun(id)
    } else {
      // it's possible that file was already there but watcher triggered "add" event instead
      const needsRerun = this.handleFileChanged(id)
      if (needsRerun) {
        this.scheduleRerun(id)
      }
    }
  }

  private handleSetupFile(filepath: string) {
    let isSetupFile: boolean = false

    this.vitest.projects.forEach((project) => {
      if (!project.config.setupFiles.includes(filepath)) {
        return
      }

      this.vitest.state.filesMap.forEach((files) => {
        files.forEach((file) => {
          if (file.projectName === project.name) {
            isSetupFile = true
            this.changedTests.add(file.filepath)
          }
        })
      })
    })

    return isSetupFile
  }

  /**
   * @returns A value indicating whether rerun is needed (changedTests was mutated)
   */
  private handleFileChanged(filepath: string): boolean {
    if (this.changedTests.has(filepath) || this.invalidates.has(filepath)) {
      return false
    }

    if (pm.isMatch(filepath, this.vitest.config.forceRerunTriggers)) {
      this.vitest.state.getFilepaths().forEach((file) => this.changedTests.add(file))
      return true
    }

    if (this.handleSetupFile(filepath)) {
      return true
    }

    const projects = this.vitest.projects.filter((project) => {
      return project._getViteEnvironments().some(({ moduleGraph }) => {
        return moduleGraph.getModulesByFile(filepath)?.size
      })
    })
    if (!projects.length) {
      // if there are no modules it's possible that server was restarted
      // we don't have information about importers anymore, so let's check if the file is a test file at least
      if (
        this.vitest.state.filesMap.has(filepath) ||
        this.vitest.projects.some((project) => project._isCachedTestFile(filepath))
      ) {
        this.changedTests.add(filepath)
        return true
      }
      return false
    }

    const files: string[] = []

    for (const project of projects) {
      const environmentMods = project
        ._getViteEnvironments()
        .map(({ moduleGraph }) => moduleGraph.getModulesByFile(filepath))
      if (!environmentMods.length) {
        continue
      }

      this.invalidates.add(filepath)

      // one of test files that we already run, or one of test files that we can run
      if (this.vitest.state.filesMap.has(filepath) || project._isCachedTestFile(filepath)) {
        this.changedTests.add(filepath)
        files.push(filepath)
        continue
      }

      let rerun = false
      for (const mods of environmentMods) {
        for (const mod of mods || []) {
          mod.importers.forEach((i) => {
            if (!i.file) {
              return
            }

            const needsRerun = this.handleFileChanged(i.file)
            if (needsRerun) {
              rerun = true
            }
          })
        }
      }

      if (rerun) {
        files.push(filepath)
      }
    }

    return !!files.length
  }

  public createTracker(): {
    track: Track
    stop: () => void
  } {
    const watcher = this.vitest.vite.watcher

    watcher.on('all', this.handleTrackEvent)

    const stop = () => {
      watcher.off('all', this.handleTrackEvent)

      this.trackers.clear()
    }

    return {
      track: this.track,
      // @todo: implement [Symbol.dispose] when dropping support for Node 22
      stop,
    }
  }

  private track: Track = (filepath, { timeout, type = 'any' } = {}) => {
    const eventTrackers: FileTrackers = this.trackers.get(type) ?? new Map()

    if (eventTrackers.size === 0) {
      this.trackers.set(type, eventTrackers)
    }

    const normalizedFilepath = normalize(filepath)
    const fileTrackers = eventTrackers.get(normalizedFilepath) ?? new Set()

    if (fileTrackers.size === 0) {
      eventTrackers.set(normalizedFilepath, fileTrackers)
    }

    const resolvers = Promise.withResolvers<void>()

    if (timeout) {
      const timeoutId = setTimeout(resolvers.reject, timeout)

      resolvers.promise = resolvers.promise
        .then(() => {
          clearTimeout(timeoutId)
        })
        .catch(() => {})
    }

    resolvers.promise = resolvers.promise.finally(() => {
      fileTrackers.delete(resolvers)
    })

    fileTrackers.add(resolvers)

    return resolvers.promise
  }

  private handleTrackEvent = (eventName: EventName, path: string): void => {
    this.resolveTrackEvent('any', path)
    this.resolveTrackEvent(eventName, path)
  }

  private resolveTrackEvent(eventName: TrackEventName, path: string): void {
    const eventTrackers = this.trackers.get(eventName)
    const fileTrackers = eventTrackers?.get(path)

    if (fileTrackers === undefined) {
      return
    }

    for (const resolvers of fileTrackers) {
      resolvers.resolve()
    }
  }
}

export interface WatcherTriggerPattern {
  pattern: RegExp
  testsToRun: (file: string, match: RegExpMatchArray) => string[] | string | null | undefined | void
}
