import type { SerializedTestSpecification } from '../runtime/types/utils'
import type { TestProject } from './project'
import type { Pool } from './types/pool-options'

export class TestSpecification {
  /**
   * @deprecated use `project` instead
   */
  public readonly 0: TestProject
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
    workspaceProject: TestProject,
    moduleId: string,
    pool: Pool,
    // location?: WorkspaceSpecLocation | undefined,
  ) {
    this[0] = workspaceProject
    this[1] = moduleId
    this[2] = { pool }
    this.project = workspaceProject
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
    yield this.project
    yield this.moduleId
    yield this.pool
  }
}

// interface WorkspaceSpecLocation {
//   start: number
//   end: number
// }
