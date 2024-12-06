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

  /**
   * The test project that the module belongs to.
   */
  public readonly project: TestProject
  /**
   * The ID of the module in the Vite module graph. It is usually an absolute file path.
   */
  public readonly moduleId: string
  /**
   * The current test pool. It's possible to have multiple pools in a single test project with `poolMatchGlob` and `typecheck.enabled`.
   * @experimental In Vitest 4, the project will only support a single pool and this property will be removed.
   */
  public readonly pool: Pool
  /**
   * Line numbers of the test locations to run.
   */
  public readonly testLines: number[] | undefined

  constructor(
    project: TestProject,
    moduleId: string,
    pool: Pool,
    testLines?: number[] | undefined,
  ) {
    this[0] = project
    this[1] = moduleId
    this[2] = { pool }
    this.project = project
    this.moduleId = moduleId
    this.pool = pool
    this.testLines = testLines
  }

  toJSON(): SerializedTestSpecification {
    return [
      {
        name: this.project.config.name,
        root: this.project.config.root,
      },
      this.moduleId,
      { pool: this.pool, testLines: this.testLines },
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
