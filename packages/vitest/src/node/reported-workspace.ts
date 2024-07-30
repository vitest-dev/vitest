import type { ProvidedContext } from '../types/general'
import type { ResolvedConfig, ResolvedProjectConfig, SerializedConfig } from './types/config'
import type { WorkspaceProject } from './workspace'
import type { Vitest } from './core'

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

  private constructor(workspaceProject: WorkspaceProject) {
    this.workspaceProject = workspaceProject
    this.vitest = workspaceProject.ctx
    this.globalConfig = workspaceProject.ctx.config
    this.config = workspaceProject.config
  }

  /**
   * Serialized project configuration. This is the config that tests receive.
   */
  public get serializedConfig(): SerializedConfig {
    return this.workspaceProject.getSerializableConfig()
  }

  /**
   * The name of the project or an empty string if not set.
   */
  public name(): string {
    return this.workspaceProject.getName()
  }

  /**
   * Custom context provided to the project.
   */
  public context(): ProvidedContext {
    return this.workspaceProject.getProvidedContext()
  }

  /**
   * Provide a custom context to the project. This context will be available to tests once they run.
   */
  public provide<T extends keyof ProvidedContext & string>(
    key: T,
    value: ProvidedContext[T],
  ): void {
    this.workspaceProject.provide(key, value)
  }

  static register(workspaceProject: WorkspaceProject): TestProject {
    const project = new TestProject(workspaceProject)
    workspaceProject.ctx.state.reportedProjectsMap.set(workspaceProject, project)
    return project
  }
}
