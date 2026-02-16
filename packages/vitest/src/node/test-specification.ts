import type { SerializedTestSpecification } from '../runtime/types/utils'
import type { TestProject } from './project'
import type { TestModule } from './reporters/reported-tasks'
import type { Pool } from './types/config'
import { generateFileHash } from '@vitest/runner/utils'
import { relative } from 'pathe'

export interface TestSpecificationOptions {
  testNamePattern?: RegExp
  testIds?: string[]
  testLines?: number[]
  testTagsFilter?: string[]
}

export class TestSpecification {
  /**
   * The task id associated with the test module.
   */
  public readonly taskId: string
  /**
   * The test project that the module belongs to.
   */
  public readonly project: TestProject
  /**
   * The id of the module in the Vite module graph. It is usually an absolute file path.
   */
  public readonly moduleId: string
  /**
   * The current test pool. It's possible to have multiple pools in a single test project with `typecheck.enabled`.
   */
  public readonly pool: Pool
  /**
   * Line numbers of the test locations to run.
   */
  public readonly testLines: number[] | undefined
  /**
   * Regular expression pattern to filter test names.
   */
  public readonly testNamePattern: RegExp | undefined
  /**
   * The ids of tasks inside of this specification to run.
   */
  public readonly testIds: string[] | undefined
  /**
   * The tags of tests to run.
   */
  public readonly testTagsFilter: string[] | undefined

  /**
   * This class represents a test suite for a test module within a single project.
   * @internal
   */
  constructor(
    project: TestProject,
    moduleId: string,
    pool: Pool,
    testLinesOrOptions?: number[] | TestSpecificationOptions | undefined,
  ) {
    const projectName = project.config.name
    const hashName = pool !== 'typescript'
      ? projectName
      : projectName
      // https://github.com/vitest-dev/vitest/blob/main/packages/vitest/src/typecheck/collect.ts#L58
        ? `${projectName}:__typecheck__`
        : '__typecheck__'
    this.taskId = generateFileHash(
      relative(project.config.root, moduleId),
      hashName,
    )
    this.project = project
    this.moduleId = moduleId
    this.pool = pool
    if (Array.isArray(testLinesOrOptions)) {
      this.testLines = testLinesOrOptions
    }
    else if (testLinesOrOptions && typeof testLinesOrOptions === 'object') {
      this.testLines = testLinesOrOptions.testLines
      this.testNamePattern = testLinesOrOptions.testNamePattern
      this.testIds = testLinesOrOptions.testIds
      this.testTagsFilter = testLinesOrOptions.testTagsFilter
    }
  }

  /**
   * Test module associated with the specification. This will be `undefined` if tests have not been run yet.
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
      {
        pool: this.pool,
        testLines: this.testLines,
        testIds: this.testIds,
        testNamePattern: this.testNamePattern,
        testTagsFilter: this.testTagsFilter,
      },
    ]
  }
}
