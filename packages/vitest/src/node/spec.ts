import type { SerializedTestSpecification } from '../runtime/types/utils'
import type { TestProject } from './project'
import type { TestModule } from './reporters/reported-tasks'
import type { Pool } from './types/config'
import { generateFileHash } from '@vitest/runner/utils'
import { relative } from 'pathe'

export class TestSpecification {
  /**
   * The task ID associated with the test module.
   */
  public readonly taskId: string
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
    const name = project.config.name
    const hashName = pool !== 'typescript'
      ? name
      : name
      // https://github.com/vitest-dev/vitest/blob/main/packages/vitest/src/typecheck/collect.ts#L58
        ? `${name}:__typecheck__`
        : '__typecheck__'
    this.taskId = generateFileHash(
      relative(project.config.root, moduleId),
      hashName,
    )
    this.project = project
    this.moduleId = moduleId
    this.pool = pool
    this.testLines = testLines
  }

  /**
   * Test module associated with the specification.
   */
  get testModule(): TestModule | undefined {
    const task = this.project.vitest.state.idMap.get(this.taskId)
    if (!task) {
      return undefined
    }
    return this.project.vitest.state.getReportedEntity(task) as TestModule | undefined
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
}
