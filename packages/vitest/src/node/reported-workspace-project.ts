import type { ProvidedContext } from '../types/general'
import type { ResolvedConfig, ResolvedProjectConfig, SerializedConfig } from './types/config'
import type { WorkspaceProject } from './workspace'
import type { Vitest } from './core'
import type { BrowserServer } from './types/browser'
import { type WorkspaceSpec, getFilePoolName } from './pool'
import { VitestContext } from './context'

export class TestProject {
  /**
   * The global vitest instance.
   * @experimental The public Vitest API is experimental and does not follow semver.
   */
  public readonly vitest: Vitest
  /**
   * The workspace project this test project is associated with.
   * @experimental The public Vitest API is experimental and does not follow semver.
   */
  public readonly workspaceProject: WorkspaceProject

  /**
   * Resolved project configuration.
   */
  public readonly config: ResolvedProjectConfig
  /**
   * Resolved global configuration. If there are no workspace projects, this will be the same as `config`.
   */
  public readonly globalConfig: ResolvedConfig

  /**
   * The name of the project or an empty string if not set.
   */
  public readonly name: string

  /**
   * Context manager.
   */
  public readonly context: VitestContext

  constructor(workspaceProject: WorkspaceProject) {
    this.workspaceProject = workspaceProject
    this.vitest = workspaceProject.ctx
    this.globalConfig = workspaceProject.ctx.config
    this.config = workspaceProject.config
    this.name = workspaceProject.getName()
    this.context = new VitestContext(workspaceProject)
  }

  /**
   * Serialized project configuration. This is the config that tests receive.
   */
  public get serializedConfig(): SerializedConfig {
    return this.workspaceProject.getSerializableConfig()
  }

  /**
   * Browser server if the project has browser enabled.
   */
  public get browser(): BrowserServer | null {
    return this.workspaceProject.browser || null
  }

  /**
   * Create test specification describing a test module.
   * @param moduleId File path to the module or an ID that Vite understands (like a virtual module).
   * @param pool The pool to run the test in. If not provided, a pool will be selected based on the project configuration.
   */
  public createSpecification(moduleId: string, pool?: string): WorkspaceSpec {
    return this.workspaceProject.createSpec(
      moduleId,
      pool || getFilePoolName(this.workspaceProject, moduleId),
    )
  }

  public toJSON(): SerializedTestProject {
    return {
      name: this.name,
      serializedConfig: this.serializedConfig,
      context: this.workspaceProject.getProvidedContext(),
    }
  }
}

interface SerializedTestProject {
  name: string
  serializedConfig: SerializedConfig
  context: ProvidedContext
}
