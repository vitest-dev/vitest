/* eslint-disable ts/method-signature-style */
import type { ModuleNode, ViteDevServer } from 'vite'
import type { SnapshotResult } from '@vitest/snapshot'
import type { TestProject } from './reported-test-project'
import type { ResolvedConfig } from './types/config'
import { VitestContext } from './context'
import type { Logger } from './logger'
import type { Vitest as VitestCore } from './core'
import { type VitestRunner, VitestRunner_ } from './publicRunner'

interface _Reporter {
  version: 2
  onInit(vitest: Vitest): void
}

export interface Vitest {
  readonly config: ResolvedConfig
  readonly projects: TestProject[]
  readonly vite: ViteDevServer
  readonly moduleGraph: VitestModuleGraph
  readonly runner: VitestRunner
  readonly context: VitestContext
  readonly snapshot: VitestSnapshot
  readonly logger: Logger

  onClose(cb: () => void): void

  close(): Promise<void>
  exit(): Promise<void>
}

const kVitest = Symbol('vitest')

export class _Vitest implements Vitest {
  private readonly [kVitest]: VitestCore
  public readonly runner: VitestRunner
  public readonly context: VitestContext
  public readonly snapshot: VitestSnapshot

  constructor(
    vitest: VitestCore,
    public readonly config: ResolvedConfig,
    public readonly projects: TestProject[],
    public readonly vite: ViteDevServer,
    public readonly moduleGraph: VitestModuleGraph,
    public readonly logger: Logger,
  ) {
    this[kVitest] = vitest
    this.runner = new VitestRunner_(vitest, moduleGraph)
    this.context = new VitestContext(vitest.getCoreWorkspaceProject())
    this.snapshot = new VitestSnapshot(vitest)
  }

  onClose(cb: () => void): void {
    this[kVitest].onClose(cb)
  }

  async close(): Promise<void> {
    await this[kVitest].close()
  }

  async exit(): Promise<void> {
    await this[kVitest].exit()
  }
}

export interface VitestModuleGraph {
  getTestModuleIds(moduleNames?: string[]): string[]
  getViteModuleNodeById(
    transformMode: 'web' | 'ssr' | 'browser',
    moduleId: string,
  ): ModuleNode | undefined
  getViteModuleNodesById(moduleId: string): ModuleNode[]
  invalidateViteModulesByFile(file: string): void
}

class VitestSnapshot {
  private readonly [kVitest]: VitestCore

  constructor(vitest: VitestCore) {
    this[kVitest] = vitest
  }

  clear() {
    this[kVitest].snapshot.clear()
  }

  add(result: SnapshotResult) {
    this[kVitest].snapshot.add(result)
  }

  get summary() {
    return this[kVitest].snapshot.summary
  }

  async update(files?: string[]): Promise<void> {
    await this[kVitest].updateSnapshot(files)
  }
}
