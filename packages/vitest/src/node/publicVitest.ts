/* eslint-disable ts/method-signature-style */
import type { ModuleNode, ViteDevServer } from 'vite'
import { SnapshotManager } from '@vitest/snapshot/manager'
import type { TestProject } from './reported-workspace-project'
import type { TestModule } from './reporters/reported-tasks'
import type { TestSpecification } from './spec'
import type { ResolvedConfig } from './types/config'
import type { VitestContext } from './context'
import type { Logger } from './logger'
import type { VitestPackageInstaller } from './packageInstaller'

export interface Vitest {
  readonly config: ResolvedConfig
  readonly projects: TestProject[]
  readonly vite: ViteDevServer
  readonly moduleGraph: VitestModuleGraph
  readonly runner: VitestRunner
  readonly context: VitestContext
  readonly snapshot: VitestSnapshot
  readonly logger: Logger
  readonly packageInstaller: VitestPackageInstaller

  onClose(cb: () => void): void

  close(): Promise<void>
  exit(): Promise<void>
}

interface VitestModuleGraph {
  getTestModuleIds(moduleNames?: string[]): string[]
  getViteModuleNodeById(
    transformMode: 'web' | 'ssr' | 'browser',
    moduleId: string,
  ): ModuleNode | undefined
  getViteModuleNodesById(moduleId: string): ModuleNode[]
}

interface VitestRunner {
  // Vitest starts a standalone runner, will react on watch changes, it doesn't run tests
  start(): Promise<void>

  // Vitest will still start in a standalone mode if `watch` is `true`
  run(): Promise<TestModule[]>
  runModules(moduleNames: string[]): Promise<TestModule[]>
  runTests(filters: TestSpecification[]): Promise<TestModule[]>
}

class VitestSnapshot extends SnapshotManager {
  async update(_files?: string[]): Promise<void> {
    // TODO
  }
}
