import type { Vitest } from '../core'
import type { TestProject } from '../project'
import type { TestProjectConfiguration } from './config'

export interface VitestPluginContext {
  vitest: Vitest
  project: TestProject
  injectTestProjects: (config: TestProjectConfiguration | TestProjectConfiguration[]) => Promise<TestProject[]>
}
