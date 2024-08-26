import type { TestProject } from './reported-workspace-project'
import type { Pool } from './types/pool-options'
import type { WorkspaceProject } from './workspace'

export class TestSpecification {
  // backwards compatibility
  /**
   * @deprecated
   */
  public readonly 0: WorkspaceProject
  /**
   * @deprecated
   */
  public readonly 1: string
  /**
   * @deprecated
   */
  public readonly 2: { pool: Pool }

  public readonly project: TestProject
  public readonly moduleId: string
  public readonly pool: Pool
  // public readonly location: WorkspaceSpecLocation | undefined

  constructor(
    workspaceProject: WorkspaceProject,
    moduleId: string,
    pool: Pool,
    // location?: WorkspaceSpecLocation | undefined,
  ) {
    this[0] = workspaceProject
    this[1] = moduleId
    this[2] = { pool }
    this.project = workspaceProject.testProject
    this.moduleId = moduleId
    this.pool = pool
    // this.location = location
  }

  /**
   * for backwards compatibility
   * @deprecated
   */
  *[Symbol.iterator]() {
    yield this.project.workspaceProject
    yield this.moduleId
    yield this.pool
  }
}

// interface WorkspaceSpecLocation {
//   start: number
//   end: number
// }
