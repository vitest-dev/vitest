import type { SerializedTestSpecification } from '../runtime/types/utils'
import type { TestProject } from './reported-test-project'
import type { Pool } from './types/pool-options'
import type { WorkspaceProject } from './workspace'

export class TestSpecification {
  /**
   * @deprecated use `project` instead
   */
  public readonly 0: WorkspaceProject
  /**
   * @deprecated use `moduleId` instead
   */
  public readonly 1: string
  /**
   * @deprecated use `pool` instead
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

  toJSON(): SerializedTestSpecification {
    return [
      {
        name: this.project.config.name,
        root: this.project.config.root,
      },
      this.moduleId,
      { pool: this.pool },
    ]
  }

  /**
   * for backwards compatibility
   * @deprecated
   */
  *[Symbol.iterator]() {
    yield this[0]
    yield this[1]
    yield this[2]
  }
}

// interface WorkspaceSpecLocation {
//   start: number
//   end: number
// }
