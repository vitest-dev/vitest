import type { Vitest } from '../core'
import type { TestSpecification } from '../test-specification'
import type { CachedTestFileResult } from './results'
import { statSync } from 'node:fs'
import { resolve } from 'pathe'
import { DependenciesCache } from './dependencies'
import { FileSystemModuleCache } from './fsModuleCache'
import { ResultsCache } from './results'

export class VitestCache {
  /** @internal */
  _results: ResultsCache
  /** @internal */
  _modules: FileSystemModuleCache
  /** @internal */
  _dependencies: DependenciesCache

  private fileStats = new Map<string, { size: number } | undefined>()
  private warnedMethods = new Set<string>()

  /** @internal */
  constructor(private vitest: Vitest) {
    this._results = new ResultsCache(vitest)
    this._modules = new FileSystemModuleCache(vitest)
    this._dependencies = new DependenciesCache(vitest)
  }

  /**
   * Returns the result of the test file from the previous test runs.
   */
  getTestSpecificationResult(specification: TestSpecification): CachedTestFileResult | undefined {
    return this._results.get(specification)
  }

  /**
   * @deprecated Use `getTestSpecificationResult(specification)` instead.
   */
  getFileTestResults(key: string): CachedTestFileResult | undefined {
    this.deprecate('getFileTestResults', 'Use "getTestSpecificationResult(specification)" instead.')
    return this._results.getByLegacyKey(key)
  }

  /**
   * @deprecated Vitest does not cache file sizes anymore. Read the size from the file system instead.
   */
  getFileStats(key: string): { size: number } | undefined {
    this.deprecate('getFileStats', 'Read the size from the file system instead.')
    if (!this.fileStats.has(key)) {
      this.fileStats.set(key, this.readFileStats(key))
    }
    return this.fileStats.get(key)
  }

  /** @internal */
  async _load(): Promise<void> {
    await Promise.all([this._results.read(), this._modules.ensureCacheIntegrity()])
  }

  /** @internal */
  async _update(specifications: TestSpecification[], startTime: number): Promise<void> {
    await Promise.all([
      this._results.update(specifications, startTime),
      this._dependencies.update(specifications, startTime),
    ])
  }

  /** @internal */
  async _clear(): Promise<void> {
    await Promise.all([
      this._results.clear(),
      this._dependencies.clear(),
      this._modules.clearCache(),
    ])
  }

  private readFileStats(key: string): { size: number } | undefined {
    for (const project of this.vitest.projects) {
      const prefix = `${project.name}:`
      if (!key.startsWith(prefix)) {
        continue
      }
      try {
        const file = resolve(this.vitest.config.root, key.slice(prefix.length))
        const stats = statSync(file, { throwIfNoEntry: false })
        if (stats) {
          return { size: stats.size }
        }
      } catch {}
    }
  }

  private deprecate(method: string, message: string): void {
    if (!this.warnedMethods.has(method)) {
      this.warnedMethods.add(method)
      this.vitest.logger.deprecate(`"vitest.cache.${method}" is deprecated. ${message}`)
    }
  }
}
