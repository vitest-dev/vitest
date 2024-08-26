import type { ProvidedContext } from '../types/general'
import type { WorkspaceProject } from './workspace'

export class VitestContext {
  constructor(private workspaceProject: WorkspaceProject) {
    this.workspaceProject = workspaceProject
  }

  /**
   * Provide a custom serializable context to the project. This context will be available for tests once they run.
   */
  public provide<T extends keyof ProvidedContext & string>(
    key: T,
    value: ProvidedContext[T],
  ): void {
    this.workspaceProject.provide(key, value)
  }

  /**
   * Get a custom serializable context provided to the project.
   */
  public get<T extends keyof ProvidedContext & string>(name: T): ProvidedContext[T] {
    return this.workspaceProject.getProvidedContext()[name]
  }
}
