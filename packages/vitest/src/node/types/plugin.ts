import type { CacheKeyIdGenerator } from '../cache/fsModuleCache'
import type { Vitest } from '../core'
import type { TestProject } from '../project'
import type { TestProjectConfiguration } from './config'

export interface VitestPluginContext {
  vitest: Vitest
  project: TestProject
  injectTestProjects: (config: TestProjectConfiguration | TestProjectConfiguration[]) => Promise<TestProject[]>
  /**
   * Define a generator that will be applied before hashing the cache key.
   *
   * Use this to make sure Vitest generates correct hash. It is a good idea
   * to define this function if your plugin can be registered with different options.
   *
   * This is called only if `experimental.fsModuleCache` is defined.
   * @experimental
   */
  experimental_defineCacheKeyGenerator: (callback: CacheKeyIdGenerator) => void
}
